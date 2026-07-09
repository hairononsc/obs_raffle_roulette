import { button, el } from '../core/dom.js';
import type { PanelActions } from '../actions.js';
import type { PanelState } from '../state/store.js';

/** Operator controls for the live chest: keys, open/close/reset, config. */
export class ChestControlView {
  readonly root = el('section', { className: 'card' });
  private readonly statusLine = el('div', { className: 'chest-status' });
  private readonly addKeyBtn: HTMLButtonElement;
  private readonly removeKeyBtn: HTMLButtonElement;
  private readonly openBtn: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;
  private readonly prizeInput = el('input', {
    attrs: { placeholder: '👖 Jean Gratis', maxlength: '100' },
  });
  private readonly targetInput = el('input', {
    attrs: { type: 'number', min: '1', max: '50', value: '5' },
  });

  constructor(private readonly actions: PanelActions) {
    this.addKeyBtn = button('➕ Llave', 'btn btn-primary', () => {
      void this.actions.addChestKey();
    });
    this.removeKeyBtn = button('➖ Llave', 'btn', () => {
      void this.actions.removeChestKey();
    });
    this.openBtn = button('🔓 Abrir', 'btn', () => {
      void this.actions.openChest();
    });
    this.closeBtn = button('🔒 Cerrar', 'btn', () => {
      void this.actions.closeChest();
    });
    const resetBtn = button('♻️ Reiniciar', 'btn', () => {
      if (confirm('¿Reiniciar el cofre? Las llaves vuelven a 0.')) {
        void this.actions.resetChest();
      }
    });

    this.root.append(
      el('h2', { text: '🪙 Cofre del Live' }),
      this.statusLine,
      el('div', { className: 'button-row' }, [
        this.addKeyBtn,
        this.removeKeyBtn,
        this.openBtn,
        this.closeBtn,
        resetBtn,
      ]),
      el('div', { className: 'settings-grid' }, [
        el('label', { className: 'field' }, [el('span', { text: 'Premio' }), this.prizeInput]),
        el('label', { className: 'field' }, [
          el('span', { text: 'Total de llaves' }),
          this.targetInput,
        ]),
      ]),
      button('💾 Guardar cofre', 'btn btn-primary', () => {
        this.save();
      }),
    );
  }

  update(state: PanelState): void {
    const chest = state.chest;
    if (!chest) {
      this.statusLine.textContent = '…';
      return;
    }

    const unlocked = chest.status === 'unlocked';
    this.statusLine.textContent = unlocked
      ? `🔓 ABIERTO — ${chest.prize}`
      : `🔒 Cerrado — 🔑 ${String(chest.keys)} / ${String(chest.keysTarget)}`;

    this.addKeyBtn.disabled = unlocked;
    this.removeKeyBtn.disabled = unlocked || chest.keys === 0;
    this.openBtn.disabled = unlocked;
    this.closeBtn.disabled = !unlocked;

    if (document.activeElement !== this.prizeInput) {
      this.prizeInput.value = chest.prize;
    }
    if (document.activeElement !== this.targetInput) {
      this.targetInput.value = String(chest.keysTarget);
    }
  }

  private save(): void {
    const prize = this.prizeInput.value.trim();
    const keysTarget = Number.parseInt(this.targetInput.value, 10);
    if (prize === '' || Number.isNaN(keysTarget) || keysTarget < 1 || keysTarget > 50) {
      return;
    }
    void this.actions.configureChest(prize, keysTarget);
  }
}
