import type { WheelSegment } from '@wheellive/shared';
import { Container, Graphics } from 'pixi.js';

import { BannerView } from './banner-view.js';
import { ChestView } from './chest-view.js';
import { ConfettiSystem } from './confetti.js';
import { FlashOfferView } from './offer-view.js';
import { PointerView } from './pointer-view.js';
import { WHEEL_RADIUS, WheelView } from './wheel-view.js';
import type { WidgetTheme } from '../theme/theme.js';

const DESIGN_EXTENT = WHEEL_RADIUS + 150;

export type ShowModule = 'wheel' | 'chest' | 'offer';

/**
 * Composes all views and owns layout: the wheel group scales to fit the
 * window while keeping its design coordinates, so OBS sources of any size
 * (400x400 corner widget or fullscreen) render correctly.
 *
 * `show` (from the widget URL's ?show=) controls which modules exist in
 * this source; layout adapts so a single-module source centres it large.
 */
export class WidgetStage {
  readonly root = new Container();
  readonly wheel = new WheelView();
  readonly pointer = new PointerView();
  readonly banner = new BannerView();
  readonly confetti = new ConfettiSystem();
  readonly chest = new ChestView();
  readonly offer = new FlashOfferView();
  private readonly glow = new Graphics();
  private readonly wheelGroup = new Container();
  private glowPhase = 0;

  constructor(private readonly show: ReadonlySet<ShowModule>) {
    this.wheelGroup.addChild(
      this.glow,
      this.wheel.container,
      this.pointer.container,
      this.confetti.container,
    );
    this.root.addChild(
      this.wheelGroup,
      this.banner.container,
      this.chest.container,
      this.offer.container,
    );
    this.wheelGroup.visible = show.has('wheel');
    this.banner.container.visible = show.has('wheel');
    this.chest.container.visible = show.has('chest');
    // The offer view manages its own visibility (hidden until an offer
    // starts); the app never calls show() when the module is excluded.
  }

  has(module: ShowModule): boolean {
    return this.show.has(module);
  }

  applyTheme(theme: WidgetTheme, segments: readonly WheelSegment[]): void {
    this.wheel.build(segments, theme);
    this.pointer.applyTheme(theme);
    this.banner.applyTheme(theme);
    this.chest.applyTheme(theme);
    this.offer.applyTheme(theme);
    this.glow
      .clear()
      .circle(0, 0, WHEEL_RADIUS + 70)
      .fill({ color: theme.glowColor, alpha: 0.14 });
  }

  layout(width: number, height: number): void {
    const unit = Math.min(width, height);
    const wheelVisible = this.show.has('wheel');
    const chestVisible = this.show.has('chest');
    const offerVisible = this.show.has('offer');

    if (wheelVisible) {
      const scale = unit / (DESIGN_EXTENT * 2.35);
      this.wheelGroup.scale.set(scale);
      this.wheelGroup.position.set(width / 2, height / 2 - 30 * scale);
      this.banner.container.position.set(width / 2, height / 2 + (WHEEL_RADIUS + 105) * scale);
      this.banner.container.scale.set(scale);
    }

    if (chestVisible) {
      if (!wheelVisible && !offerVisible) {
        // Dedicated chest source: centred and large (~design 480x560).
        this.chest.container.scale.set(Math.min(width / 480, height / 560));
        this.chest.container.position.set(width / 2, height / 2);
      } else if (!wheelVisible) {
        // chest + offer stacked.
        this.chest.container.scale.set(unit / 900);
        this.chest.container.position.set(width / 2, height * 0.72);
      } else {
        // Companion to the wheel: compact, bottom-left.
        this.chest.container.scale.set(unit / 1600);
        this.chest.container.position.set(width * 0.14, height * 0.72);
      }
    }

    if (offerVisible) {
      if (!wheelVisible && !chestVisible) {
        // Dedicated offer source: centred, ~80% of the canvas.
        this.offer.container.scale.set(Math.min(width / 900, height / 560));
        this.offer.container.position.set(width / 2, height / 2);
      } else if (!wheelVisible) {
        this.offer.container.scale.set(unit / 1100);
        this.offer.container.position.set(width / 2, height * 0.3);
      } else {
        // Companion to the wheel: top-centre banner.
        this.offer.container.scale.set(unit / 2200);
        this.offer.container.position.set(width / 2, height * 0.16);
      }
    }
  }

  update(dtMs: number, timeMs: number): void {
    this.pointer.update(dtMs);
    this.banner.update(timeMs);
    this.confetti.update(dtMs);
    this.chest.update(dtMs, timeMs);
    this.offer.update(dtMs, timeMs);
    this.glowPhase += dtMs;
    this.glow.alpha = 0.75 + 0.25 * Math.sin(this.glowPhase / 900);
  }
}
