import { el } from '../core/dom.js';
import { expectedCostPerSpin, formatRd } from '../logic/prize-insights.js';
import { winProbability, type PanelState } from '../state/store.js';

const DEFAULT_MONTHLY_SPINS = 200;

/**
 * Client-side cost simulator: expected cost per spin from the live prize
 * catalog (probability × cost), plus a monthly projection driven by an
 * operator-owned input that update() never overwrites.
 */
export class CostSimulatorView {
  readonly root = el('section', { className: 'card' });
  private readonly tableBody = el('tbody');
  private readonly perSpin = el('strong');
  private readonly monthly = el('strong');
  private readonly spinsInput = el('input', {
    attrs: { type: 'number', min: '1', value: String(DEFAULT_MONTHLY_SPINS) },
  });
  private lastPerSpin = 0;

  constructor() {
    const table = el('table', { className: 'prizes-table sim-table' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Premio' }),
          el('th', { text: 'Prob.' }),
          el('th', { text: 'Costo' }),
          el('th', { text: 'Aporte/giro' }),
        ]),
      ]),
      this.tableBody,
    ]);

    this.spinsInput.addEventListener('input', () => {
      this.renderMonthly();
    });

    this.root.append(
      el('h2', { text: '📊 Simulador de costo' }),
      table,
      el('div', { className: 'sim-total' }, [
        el('span', { text: '💰 Costo esperado por giro: ' }),
        this.perSpin,
      ]),
      el('div', { className: 'sim-total' }, [
        el('label', { className: 'inline-label', text: 'Giros estimados / mes ' }, [
          this.spinsInput,
        ]),
        el('span', { text: ' → ' }),
        this.monthly,
      ]),
    );
  }

  update(state: PanelState): void {
    this.tableBody.replaceChildren();

    const winnable = state.prizes.filter(
      (prize) => winProbability(prize, state.prizes) !== null,
    );
    if (winnable.length === 0) {
      this.tableBody.append(
        el('tr', {}, [
          el('td', {
            className: 'empty',
            text: 'Sin premios activos con stock.',
            attrs: { colspan: '4' },
          }),
        ]),
      );
    }

    for (const prize of state.prizes) {
      const probability = winProbability(prize, state.prizes);
      const row = el('tr', { className: probability === null ? 'row-inactive' : '' });
      const contribution = probability === null ? null : (probability / 100) * prize.cost;
      row.append(
        el('td', { text: prize.name }),
        el('td', { text: probability === null ? '—' : `${probability.toFixed(1)}%` }),
        el('td', { text: formatRd(prize.cost) }),
        el('td', { text: contribution === null ? '—' : formatRd(contribution) }),
      );
      this.tableBody.append(row);
    }

    this.lastPerSpin = expectedCostPerSpin(state.prizes);
    this.perSpin.textContent = formatRd(this.lastPerSpin);
    this.renderMonthly();
  }

  private renderMonthly(): void {
    const spins = Number.parseInt(this.spinsInput.value, 10);
    const monthly = Number.isFinite(spins) && spins > 0 ? this.lastPerSpin * spins : 0;
    this.monthly.textContent = `${formatRd(monthly)} / mes`;
  }
}
