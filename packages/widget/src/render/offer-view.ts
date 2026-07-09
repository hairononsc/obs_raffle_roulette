import { Container, Graphics, Text } from 'pixi.js';

import type { FlashOffer } from '@wheellive/shared';

import { formatMmSs, remainingMs } from '../offer/countdown.js';
import type { WidgetTheme } from '../theme/theme.js';
import { CASINO_THEME } from '../theme/theme.js';

/** Local design space: card of ~760x460 centred on (0,0). */
const CARD_W = 760;
const CARD_H = 460;

const ENTER_MS = 500;
const EXIT_MS = 400;
const WARN_THRESHOLD_MS = 60_000;
const PULSE_THRESHOLD_MS = 10_000;

type Anim =
  | { kind: 'hidden' }
  | { kind: 'entering'; t: number }
  | { kind: 'active' }
  | { kind: 'exiting'; t: number };

function backEaseOut(t: number): number {
  const c = 1.70158;
  const inv = t - 1;
  return 1 + (c + 1) * inv ** 3 + c * inv ** 2;
}

/**
 * Flash offer card. The countdown derives from `offer.endsAt` against the
 * wall clock every frame — a throttled OBS ticker resumes at the right
 * time. When it hits zero the card exits locally without waiting for the
 * server's `expired` broadcast (which then becomes a no-op).
 */
export class FlashOfferView {
  readonly container = new Container();

  /** Animation target: the stage owns `container` (layout scale/position),
   *  enter/exit animations scale this inner content instead. */
  private readonly content = new Container();
  private readonly card = new Graphics();
  private readonly header: Text;
  private readonly title: Text;
  private readonly description: Text;
  private readonly timer: Text;

  private theme: WidgetTheme = CASINO_THEME;
  private offer: FlashOffer | null = null;
  private anim: Anim = { kind: 'hidden' };
  private lastTimerText = '';

  constructor() {
    this.header = new Text({
      text: '⚡ OFERTA RELÁMPAGO ⚡',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontWeight: '900',
        fontSize: 44,
        fill: '#f5c542',
        align: 'center',
        stroke: { color: '#000000', width: 5 },
      },
    });
    this.header.anchor.set(0.5);
    this.header.position.set(0, -175);

    this.title = new Text({
      text: '',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontWeight: '900',
        fontSize: 58,
        fill: '#ffffff',
        align: 'center',
        wordWrap: true,
        wordWrapWidth: 700,
        stroke: { color: '#000000', width: 5 },
      },
    });
    this.title.anchor.set(0.5);
    this.title.position.set(0, -95);

    this.description = new Text({
      text: '',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontWeight: '400',
        fontSize: 32,
        fill: '#d8d3e8',
        align: 'center',
        wordWrap: true,
        wordWrapWidth: 700,
      },
    });
    this.description.anchor.set(0.5);
    this.description.position.set(0, -15);

    this.timer = new Text({
      text: '',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontWeight: '900',
        fontSize: 150,
        fill: '#ffffff',
        align: 'center',
        stroke: { color: '#000000', width: 10 },
      },
    });
    this.timer.anchor.set(0.5);
    this.timer.position.set(0, 120);

    this.content.addChild(this.card, this.header, this.title, this.description, this.timer);
    this.container.addChild(this.content);
    this.container.visible = false;
    this.draw();
  }

  get visibleNow(): boolean {
    return this.anim.kind !== 'hidden';
  }

  applyTheme(theme: WidgetTheme): void {
    this.theme = theme;
    this.header.style.fill = theme.offer.headerColor;
    this.title.style.fill = theme.offer.titleColor;
    this.description.style.fill = theme.offer.textColor;
    this.draw();
  }

  show(offer: FlashOffer, options: { animate: boolean } = { animate: true }): void {
    this.offer = offer;
    this.title.text = offer.title;
    this.description.text = offer.description;
    this.description.visible = offer.description.length > 0;
    this.lastTimerText = '';
    this.container.visible = true;
    if (options.animate) {
      this.anim = { kind: 'entering', t: 0 };
      this.content.alpha = 0;
      this.content.scale.set(0.3);
    } else {
      this.anim = { kind: 'active' };
      this.content.alpha = 1;
      this.content.scale.set(1);
    }
  }

  hide(options: { animate: boolean } = { animate: true }): void {
    if (this.anim.kind === 'hidden' || this.anim.kind === 'exiting') {
      return; // Idempotent: local expiry may already be running the exit.
    }
    if (options.animate) {
      this.anim = { kind: 'exiting', t: 0 };
    } else {
      this.anim = { kind: 'hidden' };
      this.container.visible = false;
      this.offer = null;
    }
  }

  update(dtMs: number, timeMs: number): void {
    switch (this.anim.kind) {
      case 'hidden':
        return;
      case 'entering': {
        this.anim.t += dtMs;
        const progress = Math.min(1, this.anim.t / ENTER_MS);
        this.content.alpha = progress;
        this.content.scale.set(0.3 + 0.7 * backEaseOut(progress));
        if (progress >= 1) {
          this.content.scale.set(1);
          this.anim = { kind: 'active' };
        }
        this.updateTimer(timeMs);
        return;
      }
      case 'active': {
        this.header.scale.set(1 + 0.03 * Math.sin(timeMs / 200));
        this.updateTimer(timeMs);
        return;
      }
      case 'exiting': {
        this.anim.t += dtMs;
        const progress = Math.min(1, this.anim.t / EXIT_MS);
        this.content.alpha = 1 - progress;
        this.content.scale.set(1 + 0.15 * progress);
        if (progress >= 1) {
          this.anim = { kind: 'hidden' };
          this.container.visible = false;
          this.content.scale.set(1);
          this.offer = null;
        }
        return;
      }
    }
  }

  private updateTimer(timeMs: number): void {
    if (!this.offer) {
      return;
    }
    const remaining = remainingMs(this.offer.endsAt, Date.now());
    const text = formatMmSs(remaining);
    if (text !== this.lastTimerText) {
      this.lastTimerText = text;
      this.timer.text = text;
      this.timer.style.fill =
        remaining < WARN_THRESHOLD_MS ? this.theme.offer.timerWarnColor : this.theme.offer.timerColor;
    }
    if (remaining < PULSE_THRESHOLD_MS && remaining > 0) {
      this.timer.scale.set(1 + 0.06 * Math.sin(timeMs / 110));
    } else {
      this.timer.scale.set(1);
    }
    if (remaining <= 0 && this.anim.kind === 'active') {
      // Local expiry: exit now; the server's `expired` broadcast is a no-op.
      this.hide({ animate: true });
    }
  }

  private draw(): void {
    const { bgColor, borderColor } = this.theme.offer;
    const hw = CARD_W / 2;
    const hh = CARD_H / 2;
    const g = this.card;
    g.clear();
    g.roundRect(-hw, -hh, CARD_W, CARD_H, 28).fill({ color: bgColor, alpha: 0.92 });
    g.roundRect(-hw, -hh, CARD_W, CARD_H, 28).stroke({ width: 8, color: borderColor });
    g.roundRect(-hw + 14, -hh + 14, CARD_W - 28, CARD_H - 28, 20).stroke({
      width: 2,
      color: borderColor,
    });
    // Decorative lightning bolts in opposite corners.
    const bolt = (cx: number, cy: number, flip: number): void => {
      g.poly([
        cx + flip * -14, cy - 26,
        cx + flip * 8, cy - 26,
        cx + flip * -2, cy - 6,
        cx + flip * 12, cy - 6,
        cx + flip * -10, cy + 26,
        cx + flip * -2, cy + 2,
        cx + flip * -16, cy + 2,
      ]).fill(borderColor);
    };
    bolt(-hw + 44, -hh + 48, 1);
    bolt(hw - 44, hh - 48, -1);
  }
}
