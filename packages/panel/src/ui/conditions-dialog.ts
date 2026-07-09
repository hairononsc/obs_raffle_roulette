import type { Prize, PrizeConditions } from '@wheellive/shared';

import { button, el } from '../core/dom.js';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // visual L M X J V S D
const DAY_LABELS: Record<number, string> = { 0: 'D', 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S' };

interface NumericRule {
  check: HTMLInputElement;
  input: HTMLInputElement;
  key: 'minPurchase' | 'maxPurchase' | 'minItems' | 'maxPerDay' | 'maxPerWeek' | 'maxPerMonth';
}

/**
 * Eligibility conditions editor: one enabling checkbox per rule, value
 * inputs disabled while the rule is off. Only enabled rules are emitted;
 * everything off saves `{}`.
 */
export class ConditionsDialog {
  readonly root: HTMLDialogElement;
  private readonly title = el('h3');
  private readonly numericRules: NumericRule[] = [];
  private readonly dayCheck = el('input', { attrs: { type: 'checkbox' } });
  private readonly dayButtons = new Map<number, HTMLButtonElement>();
  private readonly hourCheck = el('input', { attrs: { type: 'checkbox' } });
  private readonly hourStart = el('select');
  private readonly hourEnd = el('select');
  private readonly hourHint = el('span', { className: 'muted hidden', text: 'franja cruza medianoche' });
  private readonly boolChecks = new Map<
    'oncePerCustomer' | 'newCustomersOnly' | 'requiresActiveOffer' | 'requiresApproval',
    HTMLInputElement
  >();
  private onSubmit: ((conditions: PrizeConditions) => void) | null = null;

  constructor() {
    this.root = document.createElement('dialog');
    this.root.className = 'prize-dialog conditions-dialog';

    const form = el('form', { attrs: { method: 'dialog' } });

    const numeric = (
      label: string,
      key: NumericRule['key'],
      attrs: Record<string, string>,
    ): HTMLElement => {
      const check = el('input', { attrs: { type: 'checkbox' } });
      const input = el('input', { attrs: { type: 'number', ...attrs } });
      input.disabled = true;
      check.addEventListener('change', () => {
        input.disabled = !check.checked;
        if (check.checked) {
          input.focus();
        }
      });
      this.numericRules.push({ check, input, key });
      return el('label', { className: 'cond-row' }, [check, el('span', { text: label }), input]);
    };

    // Days of week toggles.
    for (const day of DAY_ORDER) {
      const dayButton = button(DAY_LABELS[day] ?? '?', 'day-toggle', () => {
        if (!this.dayCheck.checked) {
          return;
        }
        dayButton.classList.toggle('day-on');
      });
      dayButton.type = 'button';
      this.dayButtons.set(day, dayButton);
    }
    this.dayCheck.addEventListener('change', () => {
      for (const dayButton of this.dayButtons.values()) {
        dayButton.disabled = !this.dayCheck.checked;
      }
    });

    // Hour selects.
    for (let hour = 0; hour < 24; hour += 1) {
      const label = `${String(hour).padStart(2, '0')}:00`;
      this.hourStart.append(el('option', { text: label, attrs: { value: String(hour) } }));
      this.hourEnd.append(el('option', { text: label, attrs: { value: String(hour) } }));
    }
    this.hourEnd.value = '23';
    this.hourStart.disabled = true;
    this.hourEnd.disabled = true;
    this.hourCheck.addEventListener('change', () => {
      this.hourStart.disabled = !this.hourCheck.checked;
      this.hourEnd.disabled = !this.hourCheck.checked;
      this.updateHourHint();
    });
    this.hourStart.addEventListener('change', () => {
      this.updateHourHint();
    });
    this.hourEnd.addEventListener('change', () => {
      this.updateHourHint();
    });

    const boolRow = (
      label: string,
      key: 'oncePerCustomer' | 'newCustomersOnly' | 'requiresActiveOffer' | 'requiresApproval',
    ): HTMLElement => {
      const check = el('input', { attrs: { type: 'checkbox' } });
      this.boolChecks.set(key, check);
      return el('label', { className: 'field-check' }, [check, label]);
    };

    form.append(
      this.title,
      el('div', { className: 'cond-section', text: 'COMPRA' }),
      numeric('Compra mínima RD$', 'minPurchase', { min: '0', step: '50' }),
      numeric('Compra máxima RD$', 'maxPurchase', { min: '0', step: '50' }),
      numeric('Artículos mínimos', 'minItems', { min: '1' }),
      el('div', { className: 'cond-section', text: 'HORARIO' }),
      el('label', { className: 'cond-row' }, [
        this.dayCheck,
        el('span', { text: 'Días de la semana' }),
        el('div', { className: 'day-toggles' }, [...this.dayButtons.values()]),
      ]),
      el('label', { className: 'cond-row' }, [
        this.hourCheck,
        el('span', { text: 'Franja horaria' }),
        this.hourStart,
        el('span', { className: 'muted', text: 'a' }),
        this.hourEnd,
        this.hourHint,
      ]),
      el('div', { className: 'cond-section', text: 'LÍMITES DE ENTREGA' }),
      numeric('Máx. por día', 'maxPerDay', { min: '1' }),
      numeric('Máx. por semana', 'maxPerWeek', { min: '1' }),
      numeric('Máx. por mes', 'maxPerMonth', { min: '1' }),
      el('div', { className: 'cond-section', text: 'CLIENTE' }),
      boolRow('Una vez por cliente', 'oncePerCustomer'),
      boolRow('Solo clientes nuevos', 'newCustomersOnly'),
      el('div', { className: 'cond-section', text: 'OTROS' }),
      boolRow('Solo con oferta relámpago activa', 'requiresActiveOffer'),
      boolRow('Requiere autorización del operador ⚠', 'requiresApproval'),
      el('p', {
        className: 'muted',
        text: 'Con autorización requerida, el premio solo será elegible cuando marques "Autorizar" al registrar la compra.',
      }),
      el('div', { className: 'dialog-actions' }, [
        button('Cancelar', 'btn btn-ghost', () => {
          this.root.close();
        }),
        button('💾 Guardar', 'btn btn-primary', () => {
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

  open(prize: Prize, onSubmit: (conditions: PrizeConditions) => void): void {
    this.onSubmit = onSubmit;
    this.title.textContent = `🎛 Condiciones · ${prize.name}`;
    const c = prize.conditions;

    for (const rule of this.numericRules) {
      const value = c[rule.key];
      rule.check.checked = value !== undefined;
      rule.input.disabled = value === undefined;
      rule.input.value = value === undefined ? '' : String(value);
    }

    this.dayCheck.checked = c.daysOfWeek !== undefined;
    for (const [day, dayButton] of this.dayButtons) {
      dayButton.disabled = c.daysOfWeek === undefined;
      dayButton.classList.toggle('day-on', c.daysOfWeek?.includes(day) ?? false);
    }

    this.hourCheck.checked = c.hourStart !== undefined || c.hourEnd !== undefined;
    this.hourStart.disabled = !this.hourCheck.checked;
    this.hourEnd.disabled = !this.hourCheck.checked;
    this.hourStart.value = String(c.hourStart ?? 0);
    this.hourEnd.value = String(c.hourEnd ?? 23);
    this.updateHourHint();

    for (const [key, check] of this.boolChecks) {
      check.checked = c[key] === true;
    }

    this.root.showModal();
  }

  private updateHourHint(): void {
    const crosses =
      this.hourCheck.checked &&
      Number.parseInt(this.hourStart.value, 10) > Number.parseInt(this.hourEnd.value, 10);
    this.hourHint.classList.toggle('hidden', !crosses);
  }

  private submit(): void {
    const conditions: PrizeConditions = {};

    for (const rule of this.numericRules) {
      if (!rule.check.checked) {
        continue;
      }
      const value = Number.parseFloat(rule.input.value);
      if (Number.isFinite(value) && value >= 0) {
        conditions[rule.key] = rule.key === 'minPurchase' || rule.key === 'maxPurchase'
          ? value
          : Math.max(1, Math.round(value));
      }
    }

    if (this.dayCheck.checked) {
      const days = [...this.dayButtons.entries()]
        .filter(([, dayButton]) => dayButton.classList.contains('day-on'))
        .map(([day]) => day)
        .sort((a, b) => a - b);
      if (days.length > 0) {
        conditions.daysOfWeek = days;
      }
    }

    if (this.hourCheck.checked) {
      conditions.hourStart = Number.parseInt(this.hourStart.value, 10);
      conditions.hourEnd = Number.parseInt(this.hourEnd.value, 10);
    }

    for (const [key, check] of this.boolChecks) {
      if (check.checked) {
        conditions[key] = true;
      }
    }

    this.root.close();
    this.onSubmit?.(conditions);
  }
}
