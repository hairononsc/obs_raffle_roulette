import type { WheelSegment } from '@wheellive/shared';
import { Container, Graphics } from 'pixi.js';

import { BannerView } from './banner-view.js';
import { ConfettiSystem } from './confetti.js';
import { PointerView } from './pointer-view.js';
import { WHEEL_RADIUS, WheelView } from './wheel-view.js';
import type { WidgetTheme } from '../theme/theme.js';

const DESIGN_EXTENT = WHEEL_RADIUS + 150;

/**
 * Composes all views and owns layout: the wheel group scales to fit the
 * window while keeping its design coordinates, so OBS sources of any size
 * (400x400 corner widget or fullscreen) render correctly.
 */
export class WidgetStage {
  readonly root = new Container();
  readonly wheel = new WheelView();
  readonly pointer = new PointerView();
  readonly banner = new BannerView();
  readonly confetti = new ConfettiSystem();
  private readonly glow = new Graphics();
  private readonly wheelGroup = new Container();
  private glowPhase = 0;

  constructor() {
    this.wheelGroup.addChild(
      this.glow,
      this.wheel.container,
      this.pointer.container,
      this.confetti.container,
    );
    this.root.addChild(this.wheelGroup, this.banner.container);
  }

  applyTheme(theme: WidgetTheme, segments: readonly WheelSegment[]): void {
    this.wheel.build(segments, theme);
    this.pointer.applyTheme(theme);
    this.banner.applyTheme(theme);
    this.glow
      .clear()
      .circle(0, 0, WHEEL_RADIUS + 70)
      .fill({ color: theme.glowColor, alpha: 0.14 });
  }

  layout(width: number, height: number): void {
    const scale = Math.min(width, height) / (DESIGN_EXTENT * 2.35);
    this.wheelGroup.scale.set(scale);
    this.wheelGroup.position.set(width / 2, height / 2 - 30 * scale);
    this.banner.container.position.set(width / 2, height / 2 + (WHEEL_RADIUS + 105) * scale);
    this.banner.container.scale.set(scale);
  }

  update(dtMs: number, timeMs: number): void {
    this.pointer.update(dtMs);
    this.banner.update(timeMs);
    this.confetti.update(dtMs);
    this.glowPhase += dtMs;
    this.glow.alpha = 0.75 + 0.25 * Math.sin(this.glowPhase / 900);
  }
}
