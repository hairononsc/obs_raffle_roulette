import { Container, Graphics } from 'pixi.js';

import { WHEEL_RADIUS } from './wheel-view.js';
import type { WidgetTheme } from '../theme/theme.js';

/**
 * Damped-spring constants, tuned for stability: the natural frequency ω
 * must satisfy ω·dt << 1 at 30–60 FPS or the integration blows up and the
 * pointer flails. ω = 0.02 rad/ms → ω·dt ≈ 0.33 at 60 FPS, 0.66 at 30 FPS.
 */
const OMEGA = 0.02;
const SPRING = OMEGA * OMEGA;
const DAMPING = 2 * 0.25 * OMEGA; // ζ = 0.25 → underdamped, settles with a soft flutter
/** Impulse per pin hit; peak deflection ≈ KICK/ω ≈ 0.25 rad (~14°). */
const KICK_VELOCITY = 0.005;
const MAX_DEFLECTION = 0.35;
/** OBS frame hiccups can deliver huge deltas; clamp to keep physics sane. */
const MAX_DT_MS = 50;

/**
 * The pointer at 12 o'clock. Each segment edge that passes underneath
 * "flicks" it in the wheel's direction of travel (clockwise, like a real
 * pin), and a damped spring brings it back. During a fast spin the kicks
 * hold it steadily deflected; as the wheel slows it flutters and settles.
 */
export class PointerView {
  readonly container = new Container();
  private readonly shape = new Graphics();
  private velocity = 0;

  constructor() {
    // Pivot on the tip's base so the wiggle rotates around the mount point.
    this.container.addChild(this.shape);
    this.container.position.set(0, -(WHEEL_RADIUS + 44));
  }

  applyTheme(theme: WidgetTheme): void {
    this.shape
      .clear()
      .poly([-22, -14, 22, -14, 0, 46])
      .fill(theme.pointer.color)
      .stroke({ width: 3, color: theme.pointer.strokeColor })
      .circle(0, -14, 10)
      .fill(theme.pointer.strokeColor);
  }

  kick(): void {
    this.velocity += KICK_VELOCITY;
  }

  update(dtMs: number): void {
    const dt = Math.min(dtMs, MAX_DT_MS);
    this.velocity += (-SPRING * this.container.rotation - DAMPING * this.velocity) * dt;
    let rotation = this.container.rotation + this.velocity * dt;

    if (rotation > MAX_DEFLECTION) {
      rotation = MAX_DEFLECTION;
      this.velocity = Math.min(this.velocity, 0);
    } else if (rotation < -MAX_DEFLECTION) {
      rotation = -MAX_DEFLECTION;
      this.velocity = Math.max(this.velocity, 0);
    }
    this.container.rotation = rotation;
  }
}
