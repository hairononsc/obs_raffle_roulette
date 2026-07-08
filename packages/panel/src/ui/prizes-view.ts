import type { Prize, PrizeInput } from '@wheellive/shared';

import { button, el } from '../core/dom.js';
import type { PanelActions } from '../actions.js';
import { winProbability, type PanelState } from '../state/store.js';

/** Prize table (weight → live win %, stock, state) + create/edit dialog. */
export class PrizesView {
  readonly root = el('section', { className: 'card' });
  private readonly tableBody = el('tbody');
  private readonly dialog = new PrizeDialog();
  private spinning = false;

  constructor(private readonly actions: PanelActions) {
    const table = el('table', { className: 'prizes-table' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Premio' }),
          el('th', { text: 'Peso' }),
          el('th', { text: 'Prob.' }),
          el('th', { text: 'Stock' }),
          el('th', { text: 'Estado' }),
          el('th', { text: '' }),
        ]),
      ]),
      this.tableBody,
    ]);

    this.root.append(
      el('div', { className: 'card-header' }, [
        el('h2', { text: '🎁 Premios' }),
        button('➕ Nuevo premio', 'btn btn-primary', () => {
          if (!this.spinning) {
            this.dialog.open(null, (input) => void this.actions.createPrize(input));
          }
        }),
      ]),
      table,
      this.dialog.root,
    );
  }

  update(state: PanelState): void {
    this.spinning = state.activeSpin !== null;
    this.tableBody.replaceChildren();

    for (const prize of state.prizes) {
      const probability = winProbability(prize, state.prizes);
      const row = el('tr', { className: prize.active ? '' : 'row-inactive' });
      row.append(
        el('td', {}, [
          el('span', { className: 'color-dot', attrs: { style: `background:${prize.color}` } }),
          el('span', { text: ` ${prize.name}` }),
        ]),
        el('td', { text: String(prize.weight) }),
        el('td', { text: probability === null ? '—' : `${probability.toFixed(1)}%` }),
        el('td', {
          text: prize.stock === null ? '∞' : String(prize.stock),
          className: prize.stock === 0 ? 'stock-out' : '',
        }),
        el('td', { text: prize.active ? 'Activo' : 'Inactivo' }),
        el('td', { className: 'row-actions' }, [
          button(
            '✏️',
            'btn btn-ghost',
            () => {
              this.dialog.open(prize, (input) => void this.actions.updatePrize(prize.id, input));
            },
            { disabled: this.spinning, title: 'Editar' },
          ),
          button(
            '🗑',
            'btn btn-ghost',
            () => {
              if (confirm(`¿Eliminar el premio "${prize.name}"?`)) {
                void this.actions.deletePrize(prize.id);
              }
            },
            { disabled: this.spinning, title: 'Eliminar' },
          ),
        ]),
      );
      this.tableBody.append(row);
    }
  }
}

/** Native <dialog> with the prize form; used for both create and edit. */
class PrizeDialog {
  readonly root: HTMLDialogElement;
  private readonly name = el('input', { attrs: { maxlength: '60', required: 'true' } });
  private readonly weight = el('input', {
    attrs: { type: 'number', min: '0.1', step: '0.1', value: '1' },
  });
  private readonly stock = el('input', {
    attrs: { type: 'number', min: '0', placeholder: '∞ (vacío = ilimitado)' },
  });
  private readonly color = el('input', { attrs: { type: 'color', value: '#e63946' } });
  private readonly icon = el('input', { attrs: { value: 'prize-jeans', maxlength: '40' } });
  private readonly active = el('input', { attrs: { type: 'checkbox', checked: 'true' } });
  private onSubmit: ((input: PrizeInput) => void) | null = null;

  constructor() {
    this.root = document.createElement('dialog');
    this.root.className = 'prize-dialog';

    const form = el('form', { attrs: { method: 'dialog' } });
    form.append(
      el('h3', { text: 'Premio' }),
      field('Nombre', this.name),
      field('Peso (probabilidad relativa)', this.weight),
      field('Inventario', this.stock),
      field('Color', this.color),
      field('Icono (emoji o clave del tema)', this.icon),
      el('label', { className: 'field-check' }, [this.active, 'Activo (visible en la ruleta)']),
      el('div', { className: 'dialog-actions' }, [
        button('Cancelar', 'btn btn-ghost', () => {
          this.root.close();
        }),
        button('Guardar', 'btn btn-primary', () => {
          this.submit();
        }),
      ]),
    );
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit();
    });
    this.root.append(form);
  }

  open(prize: Prize | null, onSubmit: (input: PrizeInput) => void): void {
    this.onSubmit = onSubmit;
    this.name.value = prize?.name ?? '';
    this.weight.value = String(prize?.weight ?? 1);
    this.stock.value = prize?.stock == null ? '' : String(prize.stock);
    this.color.value = prize?.color ?? '#e63946';
    this.icon.value = prize?.icon ?? 'prize-jeans';
    this.active.checked = prize?.active ?? true;
    this.root.showModal();
    this.name.focus();
  }

  private submit(): void {
    const name = this.name.value.trim();
    const weight = Number.parseFloat(this.weight.value);
    if (name === '' || Number.isNaN(weight) || weight <= 0) {
      return;
    }
    const stockRaw = this.stock.value.trim();
    const input: PrizeInput = {
      name,
      weight,
      stock: stockRaw === '' ? null : Math.max(0, Number.parseInt(stockRaw, 10)),
      color: this.color.value,
      icon: this.icon.value.trim() === '' ? 'prize-generic' : this.icon.value.trim(),
      active: this.active.checked,
    };
    this.root.close();
    this.onSubmit?.(input);
  }
}

function field(label: string, input: HTMLElement): HTMLElement {
  return el('label', { className: 'field' }, [el('span', { text: label }), input]);
}
