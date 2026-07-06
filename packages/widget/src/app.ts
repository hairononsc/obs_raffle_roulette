import {
  createMessage,
  type ActiveSpin,
  type ServerMessage,
  type SpinLandedMessage,
  type StateSyncMessage,
  type WheelSegment,
} from '@wheellive/shared';

import type { AudioEngine } from './audio/audio-engine.js';
import type { WsClient } from './net/ws-client.js';
import type { WidgetStage } from './render/stage.js';
import { loadTheme } from './theme/theme-loader.js';
import { CASINO_THEME, type WidgetTheme } from './theme/theme.js';
import { segmentIndexAt } from './wheel/geometry.js';
import { hashToUnit } from './wheel/hash.js';
import { buildSpinTimeline, type SpinTimeline } from './wheel/spin-physics.js';

type Mode = 'connecting' | 'idle' | 'spinning' | 'celebrating';

/** Slow idle drift: keeps the wheel visibly "alive" between spins. */
const IDLE_SPEED_RAD_PER_MS = 0.00022;
/** If less than this remains of a resumed spin, jump straight to the end. */
const MIN_RESUME_MS = 800;

/**
 * Widget orchestrator. Deliberately dumb: it renders exactly what the
 * server says. It never chooses outcomes — its only outgoing game message
 * is `wheel.spin.landed`.
 */
export class WidgetApp {
  private mode: Mode = 'connecting';
  private theme: WidgetTheme = CASINO_THEME;
  private segments: readonly WheelSegment[] = [];
  private pendingSegments: readonly WheelSegment[] | null = null;
  private pendingThemeId: string | null = null;
  private spin: ActiveSpin | null = null;
  private timeline: SpinTimeline | null = null;
  private elapsedMs = 0;
  private timeMs = 0;
  private lastSegmentIndex = -1;

  constructor(
    private readonly stage: WidgetStage,
    private readonly ws: WsClient,
    private readonly audio: AudioEngine,
  ) {}

  start(): void {
    this.ws.events.on('message', (message) => {
      this.onMessage(message);
    });
    this.ws.connect();
  }

  /** Called by the Pixi ticker with the frame delta in milliseconds. */
  update(dtMs: number): void {
    this.timeMs += dtMs;

    switch (this.mode) {
      case 'spinning': {
        if (this.timeline) {
          this.elapsedMs += dtMs;
          this.stage.wheel.rotation = this.timeline.angleAt(this.elapsedMs);
          this.detectSegmentCrossing();
          if (this.timeline.isDone(this.elapsedMs)) {
            this.land();
          }
        }
        break;
      }
      case 'idle': {
        this.stage.wheel.rotation += IDLE_SPEED_RAD_PER_MS * dtMs;
        break;
      }
      default:
        break;
    }

    this.stage.wheel.updateLights(
      this.timeMs,
      this.mode === 'spinning' ? 'spinning' : this.mode === 'celebrating' ? 'celebrating' : 'idle',
    );
    this.stage.update(dtMs, this.timeMs);
  }

  private onMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'state.sync':
        void this.applySync(message.payload);
        break;
      case 'wheel.spin.start':
        this.startSpin(message.payload.spin, 0);
        break;
      case 'spin.completed':
        this.finishCelebration();
        break;
      case 'prizes.changed':
        this.applySegments(message.payload.segments);
        break;
      case 'theme.changed':
        void this.applyThemeId(message.payload.themeId);
        break;
      default:
        break;
    }
  }

  /** Single recovery path: first boot, reconnection and OBS reload all
   *  rebuild the whole widget from this snapshot. */
  private async applySync(payload: StateSyncMessage['payload']): Promise<void> {
    this.theme = await loadTheme(payload.themeId);
    this.segments = payload.segments;
    this.audio.applyTheme(this.theme);
    this.stage.applyTheme(this.theme, this.segments);

    const spin = payload.activeSpin;
    if (!spin) {
      this.toIdle();
      return;
    }
    if (spin.status === 'spinning') {
      const elapsed = Math.min(Math.max(Date.now() - spin.startedAt, 0), spin.animation.durationMs);
      this.startSpin(spin, elapsed);
      return;
    }
    // landed / celebrating: show the celebration pose without re-spinning.
    this.showCelebration(spin, { announce: false });
  }

  private startSpin(spin: ActiveSpin, elapsedMs: number): void {
    if (this.segments.length === 0) {
      console.warn('[widget] spin received with no segments; waiting for sync');
      return;
    }
    const remaining = spin.animation.durationMs - elapsedMs;
    if (remaining < MIN_RESUME_MS) {
      this.showCelebration(spin, { announce: true });
      return;
    }

    this.spin = spin;
    this.timeline = buildSpinTimeline({
      startAngle: this.stage.wheel.rotation,
      segmentCount: this.segments.length,
      targetSegmentIndex: spin.targetSegmentIndex,
      animation: { ...spin.animation, durationMs: Math.round(remaining) },
      jitter01: hashToUnit(spin.spinId),
    });
    this.elapsedMs = 0;
    this.lastSegmentIndex = segmentIndexAt(this.stage.wheel.rotation, this.segments.length);
    this.mode = 'spinning';
    this.stage.banner.setSpinning(spin.buyerName);
    this.audio.unlock();
    this.audio.play('spinStart');
  }

  private detectSegmentCrossing(): void {
    const index = segmentIndexAt(this.stage.wheel.rotation, this.segments.length);
    if (index !== this.lastSegmentIndex) {
      this.lastSegmentIndex = index;
      this.audio.play('tick');
      this.stage.pointer.kick();
    }
  }

  private land(): void {
    const spin = this.spin;
    if (!spin || !this.timeline) {
      return;
    }
    this.stage.wheel.rotation = this.timeline.finalAngle;
    this.timeline = null;
    this.ws.send(createMessage<SpinLandedMessage>('wheel.spin.landed', { spinId: spin.spinId }));
    this.showCelebration(spin, { announce: true });
  }

  private showCelebration(spin: ActiveSpin, options: { announce: boolean }): void {
    this.mode = 'celebrating';
    this.spin = spin;
    this.timeline = null;
    const prizeLabel =
      this.segments.find((segment) => segment.index === spin.targetSegmentIndex)?.label ?? 'Premio';
    this.stage.banner.setWinner(spin.buyerName, prizeLabel);
    if (options.announce) {
      this.audio.play('winner');
      this.audio.play('confetti');
      this.stage.confetti.burst(180, this.theme.confettiColors);
    }
  }

  private finishCelebration(): void {
    this.spin = null;
    this.toIdle();
  }

  private toIdle(): void {
    this.mode = 'idle';
    this.stage.banner.setIdle();
    if (this.pendingSegments) {
      this.segments = this.pendingSegments;
      this.pendingSegments = null;
      this.stage.applyTheme(this.theme, this.segments);
    }
    if (this.pendingThemeId !== null) {
      const themeId = this.pendingThemeId;
      this.pendingThemeId = null;
      void this.applyThemeId(themeId);
    }
  }

  /** Layout changes are deferred while a spin animates toward an index of
   *  the current layout; they apply as soon as the wheel is idle again. */
  private applySegments(segments: readonly WheelSegment[]): void {
    if (this.mode === 'spinning' || this.mode === 'celebrating') {
      this.pendingSegments = segments;
      return;
    }
    this.segments = segments;
    this.stage.applyTheme(this.theme, this.segments);
  }

  private async applyThemeId(themeId: string): Promise<void> {
    if (this.mode === 'spinning' || this.mode === 'celebrating') {
      this.pendingThemeId = themeId;
      return;
    }
    this.theme = await loadTheme(themeId);
    this.audio.applyTheme(this.theme);
    this.stage.applyTheme(this.theme, this.segments);
  }
}
