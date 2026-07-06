import { Container, Text } from 'pixi.js';

import type { WidgetTheme } from '../theme/theme.js';

/**
 * The text strip under the wheel: who is spinning, and — during the
 * celebration — what they won, with a pulse animation.
 */
export class BannerView {
  readonly container = new Container();
  private readonly title: Text;
  private readonly subtitle: Text;
  private pulsing = false;

  constructor() {
    this.title = new Text({
      text: '',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontWeight: '900',
        fontSize: 52,
        fill: '#ffffff',
        align: 'center',
        stroke: { color: '#000000', width: 6 },
      },
    });
    this.title.anchor.set(0.5);

    this.subtitle = new Text({
      text: '',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontWeight: '700',
        fontSize: 34,
        fill: '#f5c542',
        align: 'center',
        stroke: { color: '#000000', width: 5 },
      },
    });
    this.subtitle.anchor.set(0.5);
    this.subtitle.position.set(0, 56);

    this.container.addChild(this.title, this.subtitle);
  }

  applyTheme(theme: WidgetTheme): void {
    this.title.style.fill = theme.banner.nameColor;
    this.subtitle.style.fill = theme.banner.accentColor;
  }

  setIdle(): void {
    this.pulsing = false;
    this.container.scale.set(1);
    this.title.text = '';
    this.subtitle.text = '';
  }

  setSpinning(buyerName: string): void {
    this.pulsing = false;
    this.container.scale.set(1);
    this.title.text = buyerName;
    this.subtitle.text = '¡Girando!';
  }

  setWinner(buyerName: string, prizeLabel: string): void {
    this.pulsing = true;
    this.title.text = `🎉 ${buyerName} 🎉`;
    this.subtitle.text = prizeLabel;
  }

  update(timeMs: number): void {
    if (this.pulsing) {
      this.container.scale.set(1 + 0.06 * Math.sin(timeMs / 130));
    }
  }
}
