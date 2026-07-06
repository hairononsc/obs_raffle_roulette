import type { WheelSegment } from '@wheellive/shared';
import { Container, Graphics, Text } from 'pixi.js';

import { segmentArc, segmentCenterAngle } from '../wheel/geometry.js';
import type { WidgetTheme } from '../theme/theme.js';

export const WHEEL_RADIUS = 320;
const RIM_WIDTH = 34;
const LIGHT_RADIUS = 7;

export type LightMode = 'idle' | 'spinning' | 'celebrating';

/**
 * The wheel: a static rim with marquee lights around a rotating rotor that
 * holds the prize slices, labels and icons. Only `rotor.rotation` changes
 * per frame; geometry is rebuilt only when segments or theme change.
 */
export class WheelView {
  readonly container = new Container();
  private readonly rim = new Graphics();
  private readonly lightsLayer = new Container();
  private readonly rotor = new Container();
  private readonly hub = new Graphics();
  private lights: Graphics[] = [];
  private lightOn = 0xffe08a;
  private lightOff = 0x6b5537;

  constructor() {
    this.container.addChild(this.rim, this.rotor, this.hub, this.lightsLayer);
  }

  get rotation(): number {
    return this.rotor.rotation;
  }

  set rotation(value: number) {
    this.rotor.rotation = value;
  }

  build(segments: readonly WheelSegment[], theme: WidgetTheme): void {
    this.buildRim(theme);
    this.buildLights(theme);
    this.buildRotor(segments, theme);
    this.buildHub(theme);
  }

  /** Marquee animation. Time-based so it is framerate independent. */
  updateLights(timeMs: number, mode: LightMode): void {
    const count = this.lights.length;
    if (count === 0) {
      return;
    }
    for (const [index, light] of this.lights.entries()) {
      let on: boolean;
      if (mode === 'idle') {
        on = (index + Math.floor(timeMs / 700)) % 2 === 0;
      } else if (mode === 'spinning') {
        on = (index + Math.floor(timeMs / 90)) % 3 === 0;
      } else {
        on = Math.floor(timeMs / 120) % 2 === 0;
      }
      light.tint = on ? this.lightOn : this.lightOff;
      light.alpha = on ? 1 : 0.45;
    }
  }

  private buildRim(theme: WidgetTheme): void {
    this.rim
      .clear()
      .circle(0, 0, WHEEL_RADIUS + RIM_WIDTH)
      .fill(theme.wheel.rimColor)
      .circle(0, 0, WHEEL_RADIUS + RIM_WIDTH)
      .stroke({ width: 3, color: theme.wheel.strokeColor });
  }

  private buildLights(theme: WidgetTheme): void {
    this.lightsLayer.removeChildren();
    this.lights = [];
    this.lightOn = colorToNumber(theme.wheel.lightOnColor);
    this.lightOff = colorToNumber(theme.wheel.lightOffColor);

    const radius = WHEEL_RADIUS + RIM_WIDTH / 2;
    for (let i = 0; i < theme.wheel.lightCount; i += 1) {
      const angle = (i / theme.wheel.lightCount) * Math.PI * 2;
      const light = new Graphics().circle(0, 0, LIGHT_RADIUS).fill(0xffffff);
      light.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius);
      this.lights.push(light);
      this.lightsLayer.addChild(light);
    }
  }

  private buildRotor(segments: readonly WheelSegment[], theme: WidgetTheme): void {
    this.rotor.removeChildren();
    if (segments.length === 0) {
      return;
    }

    const arc = segmentArc(segments.length);
    const slices = new Graphics();
    for (const segment of segments) {
      const start = segment.index * arc;
      slices
        .moveTo(0, 0)
        .arc(0, 0, WHEEL_RADIUS, start, start + arc)
        .closePath()
        .fill(segment.color)
        .stroke({ width: 3, color: theme.wheel.strokeColor });
    }
    this.rotor.addChild(slices);

    const fontSize = Math.min(26, 150 * arc * 0.55);
    for (const segment of segments) {
      const angle = segmentCenterAngle(segment.index, segments.length);
      const flipped = angle > Math.PI / 2 && angle < (3 * Math.PI) / 2;

      const label = new Text({
        text: segment.label,
        style: {
          fontFamily: 'Arial, sans-serif',
          fontWeight: '700',
          fontSize,
          fill: theme.wheel.labelColor,
          stroke: { color: theme.wheel.strokeColor, width: 3 },
        },
      });
      label.anchor.set(0.5);
      label.position.set(
        Math.cos(angle) * WHEEL_RADIUS * 0.58,
        Math.sin(angle) * WHEEL_RADIUS * 0.58,
      );
      label.rotation = flipped ? angle + Math.PI : angle;
      this.rotor.addChild(label);

      const icon = new Text({
        text: theme.icons[segment.icon] ?? theme.iconFallback,
        style: { fontSize: fontSize * 1.2 },
      });
      icon.anchor.set(0.5);
      icon.position.set(
        Math.cos(angle) * WHEEL_RADIUS * 0.85,
        Math.sin(angle) * WHEEL_RADIUS * 0.85,
      );
      icon.rotation = angle + Math.PI / 2;
      this.rotor.addChild(icon);
    }
  }

  private buildHub(theme: WidgetTheme): void {
    this.hub
      .clear()
      .circle(0, 0, WHEEL_RADIUS * 0.16)
      .fill(theme.wheel.hubColor)
      .circle(0, 0, WHEEL_RADIUS * 0.16)
      .stroke({ width: 5, color: theme.wheel.hubAccentColor })
      .circle(0, 0, WHEEL_RADIUS * 0.05)
      .fill(theme.wheel.hubAccentColor);
  }
}

function colorToNumber(color: string): number {
  return Number.parseInt(color.replace('#', ''), 16);
}
