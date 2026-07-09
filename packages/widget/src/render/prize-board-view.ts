import { Container, Graphics, Text } from 'pixi.js';

import type { Prize } from '@wheellive/shared';

import { boardProbability, publicRules } from '../prizes/board-info.js';
import type { WidgetTheme } from '../theme/theme.js';
import { CASINO_THEME, resolveIcon } from '../theme/theme.js';

/** Local design space: card of ~960 wide, height grows with rows. */
const BOARD_W = 960;
const HEADER_H = 110;
const ROW_H = 62;
const FOOTER_H = 34;
const MAX_ROWS = 12;

/**
 * Public prize board for the audience: every active prize with its win %
 * and customer-facing rules, live-updated from prizes.changed. Sold-out
 * prizes stay listed but dimmed as "agotado".
 */
export class PrizeBoardView {
  readonly container = new Container();

  private readonly card = new Graphics();
  private readonly title: Text;
  private readonly rows = new Container();

  private theme: WidgetTheme = CASINO_THEME;
  private prizes: readonly Prize[] = [];

  /** Height of the current design box (stage layout scales around it). */
  designHeight = HEADER_H + FOOTER_H;

  constructor() {
    this.title = new Text({
      text: '🎁 PREMIOS DE HOY',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontWeight: '900',
        fontSize: 48,
        fill: '#f5c542',
        align: 'center',
        stroke: { color: '#000000', width: 5 },
      },
    });
    this.title.anchor.set(0.5);

    this.container.addChild(this.card, this.title, this.rows);
  }

  applyTheme(theme: WidgetTheme): void {
    this.theme = theme;
    this.title.style.fill = theme.offer.headerColor;
    this.rebuild();
  }

  setPrizes(prizes: readonly Prize[]): void {
    this.prizes = prizes;
    this.rebuild();
  }

  update(timeMs: number): void {
    this.title.scale.set(1 + 0.02 * Math.sin(timeMs / 300));
  }

  private rebuild(): void {
    const visible = this.prizes.filter((prize) => prize.active).slice(0, MAX_ROWS);
    const height = HEADER_H + visible.length * ROW_H + FOOTER_H;
    this.designHeight = height;
    const top = -height / 2;
    const hw = BOARD_W / 2;

    const g = this.card;
    g.clear();
    g.roundRect(-hw, top, BOARD_W, height, 26).fill({
      color: this.theme.offer.bgColor,
      alpha: 0.92,
    });
    g.roundRect(-hw, top, BOARD_W, height, 26).stroke({
      width: 8,
      color: this.theme.offer.borderColor,
    });
    g.moveTo(-hw + 30, top + HEADER_H - 16)
      .lineTo(hw - 30, top + HEADER_H - 16)
      .stroke({ width: 2, color: this.theme.offer.borderColor });

    this.title.position.set(0, top + HEADER_H / 2 - 8);

    this.rows.removeChildren();
    visible.forEach((prize, index) => {
      const y = top + HEADER_H + index * ROW_H + ROW_H / 2;
      const soldOut = prize.stock === 0;
      const probability = boardProbability(prize, this.prizes);

      const dot = new Graphics();
      dot.circle(-hw + 44, y, 10).fill(prize.color);
      this.rows.addChild(dot);

      const name = new Text({
        text: `${resolveIcon(this.theme, prize.icon)} ${prize.name}`,
        style: {
          fontFamily: 'Arial, sans-serif',
          fontWeight: '700',
          fontSize: 30,
          fill: this.theme.offer.titleColor,
        },
      });
      name.anchor.set(0, 0.5);
      name.position.set(-hw + 70, y);
      this.rows.addChild(name);

      const probabilityText = new Text({
        text: probability === null ? '—' : `${probability.toFixed(1)}%`,
        style: {
          fontFamily: 'Arial, sans-serif',
          fontWeight: '900',
          fontSize: 28,
          fill: this.theme.offer.headerColor,
        },
      });
      probabilityText.anchor.set(1, 0.5);
      probabilityText.position.set(hw - 380, y);
      this.rows.addChild(probabilityText);

      const rules = new Text({
        text: soldOut ? 'agotado por hoy' : publicRules(prize.conditions),
        style: {
          fontFamily: 'Arial, sans-serif',
          fontWeight: '400',
          fontSize: 22,
          fill: this.theme.offer.textColor,
          align: 'right',
          wordWrap: true,
          wordWrapWidth: 330,
        },
      });
      rules.anchor.set(1, 0.5);
      rules.position.set(hw - 34, y);
      this.rows.addChild(rules);

      if (soldOut) {
        for (const node of [dot, name, probabilityText, rules]) {
          node.alpha = 0.35;
        }
      }
    });
  }
}
