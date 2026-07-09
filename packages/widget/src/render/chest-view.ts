import { Container, Graphics, Text } from 'pixi.js';

import type { ChestState } from '@wheellive/shared';

import type { WidgetTheme } from '../theme/theme.js';
import { CASINO_THEME } from '../theme/theme.js';
import { ConfettiSystem } from './confetti.js';

/** Local design space: the chest body is ~340x200 centred on (0,0). */
const BODY_W = 340;
const BODY_H = 180;
const BODY_TOP = -BODY_H / 2 + 30; // shifted down to leave room for the lid
const LID_H = 70;
/** Open pose: the lid flips backwards over its hinge line; negative
 * scale.y shows its inner face raised behind the body (2.5D trick). */
const LID_OPEN_SCALE = -0.55;

type Anim =
  | { kind: 'static' }
  | { kind: 'keyFlying'; t: number }
  | { kind: 'shaking'; t: number }
  | { kind: 'opening'; t: number; confettiFired: boolean }
  | { kind: 'revealing'; t: number };

const KEY_FLY_MS = 900;
const SHAKE_MS = 1200;
const OPEN_MS = 1400;
const REVEAL_MS = 2000;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * The live chest overlay. All drawing is Graphics + Text (no assets); the
 * animation FSM advances in update(dtMs) like every other view. setState()
 * renders any server state idempotently with no animation — that is the
 * recovery path for an OBS reload mid-show.
 */
export class ChestView {
  readonly container = new Container();

  private readonly body = new Graphics();
  private readonly lid = new Container();
  private readonly lidGraphics = new Graphics();
  private readonly lightBeam = new Graphics();
  private readonly title: Text;
  private readonly keysRow: Text;
  private readonly counter: Text;
  private readonly bigMessage: Text;
  private readonly flyingKey: Text;
  private readonly confetti = new ConfettiSystem();
  private readonly chestGroup = new Container();

  private theme: WidgetTheme = CASINO_THEME;
  private state: ChestState = { keys: 0, keysTarget: 5, prize: '', status: 'locked' };
  private anim: Anim = { kind: 'static' };
  private rowPulseMs = 0;

  constructor() {
    this.title = new Text({
      text: '🪙 COFRE DEL LIVE',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontWeight: '900',
        fontSize: 40,
        fill: '#f5c542',
        align: 'center',
        stroke: { color: '#000000', width: 6 },
      },
    });
    this.title.anchor.set(0.5);
    this.title.position.set(0, -168);

    this.keysRow = new Text({
      text: '',
      style: { fontFamily: 'Arial, sans-serif', fontSize: 40, align: 'center' },
    });
    this.keysRow.anchor.set(0.5);
    this.keysRow.position.set(0, 138);

    this.counter = new Text({
      text: '',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontWeight: '700',
        fontSize: 32,
        fill: '#f5c542',
        align: 'center',
        stroke: { color: '#000000', width: 4 },
      },
    });
    this.counter.anchor.set(0.5);
    this.counter.position.set(0, 186);

    this.bigMessage = new Text({
      text: '',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontWeight: '900',
        fontSize: 42,
        fill: '#f5c542',
        align: 'center',
        stroke: { color: '#000000', width: 7 },
      },
    });
    this.bigMessage.anchor.set(0.5);
    this.bigMessage.position.set(0, -240);

    this.flyingKey = new Text({
      text: '🔑',
      style: { fontFamily: 'Arial, sans-serif', fontSize: 56 },
    });
    this.flyingKey.anchor.set(0.5);
    this.flyingKey.visible = false;

    this.lid.addChild(this.lidGraphics);
    // Hinge at the back-top edge of the body: rotating the lid opens it backwards.
    this.lid.position.set(0, BODY_TOP);

    this.chestGroup.addChild(this.lightBeam, this.body, this.lid);
    this.container.addChild(
      this.chestGroup,
      this.title,
      this.keysRow,
      this.counter,
      this.bigMessage,
      this.flyingKey,
      this.confetti.container,
    );
    this.draw();
  }

  applyTheme(theme: WidgetTheme): void {
    this.theme = theme;
    this.title.style.fill = theme.chest.titleColor;
    this.counter.style.fill = theme.chest.trimColor;
    this.draw();
  }

  /** Idempotent render of any server state; aborts any running animation. */
  setState(state: ChestState): void {
    this.state = state;
    this.anim = { kind: 'static' };
    this.flyingKey.visible = false;
    this.container.position.set(this.container.position.x, this.container.position.y);
    this.chestGroup.position.set(0, 0);
    this.applyPose();
  }

  /** A key was granted (chest still locked): key flies in, row pulses. */
  playKeyGained(state: ChestState): void {
    this.state = state;
    this.anim = { kind: 'keyFlying', t: 0 };
    this.flyingKey.visible = false;
    this.applyPose();
  }

  /** Full unlock cinematic: shake -> open -> golden light -> confetti -> prize. */
  playUnlockSequence(state: ChestState): void {
    this.state = state;
    this.anim = { kind: 'shaking', t: 0 };
    this.flyingKey.visible = false;
    // Visual pose stays "closed" until the opening step flips it.
    this.lid.scale.y = 1;
    this.lightBeam.alpha = 0;
    this.updateTexts();
  }

  update(dtMs: number, timeMs: number): void {
    this.confetti.update(dtMs);
    if (this.rowPulseMs > 0) {
      this.rowPulseMs = Math.max(0, this.rowPulseMs - dtMs);
      this.keysRow.scale.set(1 + 0.25 * (this.rowPulseMs / 400));
    }

    switch (this.anim.kind) {
      case 'static':
        if (this.state.status === 'unlocked') {
          this.bigMessage.scale.set(1 + 0.05 * Math.sin(timeMs / 160));
        }
        return;
      case 'keyFlying': {
        this.anim.t += dtMs;
        const progress = Math.min(1, this.anim.t / KEY_FLY_MS);
        const eased = easeOutCubic(progress);
        this.flyingKey.visible = progress < 1;
        this.flyingKey.position.set(0, -240 + eased * (138 - -240));
        this.flyingKey.alpha = progress < 0.15 ? progress / 0.15 : 1;
        this.flyingKey.scale.set(1.6 - 0.6 * eased);
        if (progress >= 1) {
          this.anim = { kind: 'static' };
          this.rowPulseMs = 400;
          this.applyPose();
        }
        return;
      }
      case 'shaking': {
        this.anim.t += dtMs;
        const progress = Math.min(1, this.anim.t / SHAKE_MS);
        const amplitude = 8 * progress;
        this.chestGroup.position.set(
          amplitude * Math.sin(this.anim.t / 28),
          amplitude * 0.5 * Math.sin(this.anim.t / 19),
        );
        if (progress >= 1) {
          this.chestGroup.position.set(0, 0);
          this.anim = { kind: 'opening', t: 0, confettiFired: false };
        }
        return;
      }
      case 'opening': {
        this.anim.t += dtMs;
        const progress = Math.min(1, this.anim.t / OPEN_MS);
        const eased = easeOutCubic(progress);
        this.lid.scale.y = 1 - (1 - LID_OPEN_SCALE) * eased;
        this.lightBeam.alpha = 0.85 * eased;
        if (!this.anim.confettiFired && progress >= 0.4) {
          this.anim.confettiFired = true;
          this.confetti.burst(180, this.theme.confettiColors);
          this.bigMessage.text = '¡¡COFRE DESBLOQUEADO!!';
          this.bigMessage.style.fill = this.theme.chest.titleColor;
        }
        if (progress >= 1) {
          this.anim = { kind: 'revealing', t: 0 };
        }
        return;
      }
      case 'revealing': {
        this.anim.t += dtMs;
        this.bigMessage.scale.set(1 + 0.08 * Math.sin(this.anim.t / 120));
        if (this.anim.t >= REVEAL_MS) {
          this.anim = { kind: 'static' };
          this.applyPose();
        }
        return;
      }
    }
  }

  /** Renders the final pose for the current state (no transition). */
  private applyPose(): void {
    const unlocked = this.state.status === 'unlocked';
    this.lid.scale.y = unlocked ? LID_OPEN_SCALE : 1;
    this.lightBeam.alpha = unlocked ? 0.85 : 0;
    this.chestGroup.position.set(0, 0);
    this.updateTexts();
  }

  private updateTexts(): void {
    const { keys, keysTarget, prize, status } = this.state;
    if (keysTarget <= 10) {
      this.keysRow.text = '🔑'.repeat(keys) + '⬜'.repeat(Math.max(0, keysTarget - keys));
      this.keysRow.visible = status === 'locked';
    } else {
      this.keysRow.visible = false;
    }
    this.counter.text = `${String(keys)} / ${String(keysTarget)}`;
    this.counter.visible = status === 'locked';

    if (status === 'unlocked' && this.anim.kind !== 'shaking' && this.anim.kind !== 'opening') {
      this.bigMessage.text = prize;
      this.bigMessage.style.fill = this.theme.chest.prizeColor;
      this.bigMessage.scale.set(1);
    } else if (status === 'locked') {
      this.bigMessage.text = '';
      this.bigMessage.scale.set(1);
    }
  }

  private draw(): void {
    const { woodColor, woodDarkColor, trimColor, lightColor } = this.theme.chest;
    const hw = BODY_W / 2;

    // Golden light: a fan of beams rising from the chest mouth, behind the lid.
    const beam = this.lightBeam;
    beam.clear();
    beam.poly([-hw * 0.7, BODY_TOP, -hw * 1.15, BODY_TOP - 260, -hw * 0.25, BODY_TOP]).fill({
      color: lightColor,
      alpha: 0.55,
    });
    beam.poly([-hw * 0.3, BODY_TOP, 0, BODY_TOP - 300, hw * 0.3, BODY_TOP]).fill({
      color: lightColor,
      alpha: 0.75,
    });
    beam.poly([hw * 0.25, BODY_TOP, hw * 1.15, BODY_TOP - 260, hw * 0.7, BODY_TOP]).fill({
      color: lightColor,
      alpha: 0.55,
    });
    beam.ellipse(0, BODY_TOP, hw * 0.9, 18).fill({ color: lightColor, alpha: 0.9 });
    beam.alpha = 0;

    // Body: dark wood with plank lines, golden trim and corner braces.
    const g = this.body;
    g.clear();
    g.roundRect(-hw, BODY_TOP, BODY_W, BODY_H, 14).fill(woodColor);
    for (let i = 1; i < 4; i += 1) {
      const x = -hw + (BODY_W / 4) * i;
      g.moveTo(x, BODY_TOP + 6)
        .lineTo(x, BODY_TOP + BODY_H - 6)
        .stroke({ width: 3, color: woodDarkColor });
    }
    g.roundRect(-hw, BODY_TOP, BODY_W, BODY_H, 14).stroke({ width: 6, color: trimColor });
    // Horizontal golden bands.
    g.rect(-hw, BODY_TOP + 34, BODY_W, 10).fill(trimColor);
    g.rect(-hw, BODY_TOP + BODY_H - 44, BODY_W, 10).fill(trimColor);
    // Lock plate + keyhole.
    g.circle(0, BODY_TOP + 52, 26).fill(trimColor);
    g.circle(0, BODY_TOP + 46, 8).fill(woodDarkColor);
    g.poly([-6, BODY_TOP + 50, 6, BODY_TOP + 50, 0, BODY_TOP + 70]).fill(woodDarkColor);

    // Lid: rounded-top trapezoid hinged at the body's top edge, drawn
    // upwards from (0,0) in lid-local space so rotation opens it backwards.
    const lg = this.lidGraphics;
    lg.clear();
    lg.roundRect(-hw, -LID_H, BODY_W, LID_H, 26).fill(woodColor);
    lg.roundRect(-hw, -LID_H, BODY_W, LID_H, 26).stroke({ width: 6, color: trimColor });
    lg.rect(-hw + 20, -LID_H + 8, 14, LID_H - 16).fill(trimColor);
    lg.rect(hw - 34, -LID_H + 8, 14, LID_H - 16).fill(trimColor);
  }
}
