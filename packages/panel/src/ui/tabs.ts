import { el } from '../core/dom.js';

export interface TabDef {
  id: string;
  label: string;
  pane: HTMLElement;
}

const STORAGE_KEY = 'wheellive.panel.tab';

/**
 * Simple tab bar: one button per tab, panes toggled via display. The
 * selected tab persists across reloads so the operator comes back to
 * where they were working.
 */
export class TabBar {
  readonly root = el('nav', { className: 'tabs' });
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private readonly badges = new Map<string, HTMLElement>();
  private readonly panes = new Map<string, HTMLElement>();
  private activeId: string;

  constructor(tabs: readonly TabDef[]) {
    const stored = localStorage.getItem(STORAGE_KEY);
    this.activeId =
      stored !== null && tabs.some((tab) => tab.id === stored) ? stored : (tabs[0]?.id ?? '');

    for (const tab of tabs) {
      const badge = el('span', { className: 'tab-badge hidden' });
      const button = el('button', { className: 'tab' }, [
        el('span', { text: tab.label }),
        badge,
      ]);
      button.type = 'button';
      button.addEventListener('click', () => {
        this.select(tab.id);
      });
      this.buttons.set(tab.id, button);
      this.badges.set(tab.id, badge);
      this.panes.set(tab.id, tab.pane);
      this.root.append(button);
    }
    this.applyActive();
  }

  select(id: string): void {
    if (!this.panes.has(id) || id === this.activeId) {
      return;
    }
    this.activeId = id;
    localStorage.setItem(STORAGE_KEY, id);
    this.applyActive();
  }

  /** Small status hint on a tab (e.g. chest keys, offer running). Empty
   *  text hides the badge. */
  setBadge(id: string, text: string): void {
    const badge = this.badges.get(id);
    if (!badge) {
      return;
    }
    badge.textContent = text;
    badge.classList.toggle('hidden', text === '');
  }

  private applyActive(): void {
    for (const [id, button] of this.buttons) {
      button.classList.toggle('tab-active', id === this.activeId);
    }
    for (const [id, pane] of this.panes) {
      pane.classList.toggle('pane-hidden', id !== this.activeId);
    }
  }
}
