import { button, el } from '../core/dom.js';
import type { PanelActions } from '../actions.js';
import type { PanelState } from '../state/store.js';

/** Purchase registration form + live queue with per-entry launch buttons. */
export class QueueView {
  readonly root = el('section', { className: 'card' });
  private readonly list = el('div', { className: 'queue-list' });
  private readonly nameInput = el('input', {
    attrs: { placeholder: 'Nombre del comprador', maxlength: '50' },
  });
  private readonly spinsInput = el('input', {
    attrs: { type: 'number', min: '1', max: '50', value: '1' },
  });
  private readonly noteInput = el('input', {
    attrs: { placeholder: 'Nota (opcional)', maxlength: '200' },
  });

  constructor(private readonly actions: PanelActions) {
    const form = el('form', { className: 'queue-form' });
    form.append(
      this.nameInput,
      el('label', { className: 'inline-label', text: 'Giros' }, [this.spinsInput]),
      this.noteInput,
      button('➕ Registrar compra', 'btn btn-primary', () => {
        form.requestSubmit();
      }),
    );
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit();
    });

    this.root.append(el('h2', { text: '🛒 Cola de giros' }), form, this.list);
  }

  update(state: PanelState): void {
    this.list.replaceChildren();
    if (state.queue.length === 0) {
      this.list.append(el('p', { className: 'empty', text: 'Sin compradores en cola.' }));
      return;
    }

    const spinning = state.activeSpin !== null;
    for (const entry of state.queue) {
      const row = el('div', { className: 'queue-row' });
      row.append(
        el('div', { className: 'queue-info' }, [
          el('strong', { text: entry.buyerName }),
          el('span', {
            className: 'muted',
            text:
              `${String(entry.spinsRemaining)}/${String(entry.spinsTotal)} giros` +
              (entry.note !== undefined ? ` · ${entry.note}` : ''),
          }),
        ]),
        el('div', { className: 'queue-actions' }, [
          button(
            '🎰 Girar',
            'btn btn-spin',
            () => {
              void this.actions.launchSpin(entry.id);
            },
            {
              disabled: spinning,
              title: spinning ? 'Ya hay un giro en curso' : 'Lanzar un giro',
            },
          ),
          button('✕', 'btn btn-ghost', () => {
            void this.actions.removeEntry(entry.id);
          }),
        ]),
      );
      this.list.append(row);
    }
  }

  private submit(): void {
    const buyerName = this.nameInput.value.trim();
    const spins = Number.parseInt(this.spinsInput.value, 10);
    if (buyerName === '' || Number.isNaN(spins) || spins < 1) {
      return;
    }
    void this.actions.addBuyer(buyerName, spins, this.noteInput.value.trim());
    this.nameInput.value = '';
    this.spinsInput.value = '1';
    this.noteInput.value = '';
    this.nameInput.focus();
  }
}
