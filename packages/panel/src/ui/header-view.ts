import { el } from '../core/dom.js';
import type { PanelState } from '../state/store.js';

const STATUS_LABELS: Record<PanelState['status'], string> = {
  connecting: 'Conectando…',
  online: 'En línea',
  offline: 'Sin conexión',
};

/** Top bar: brand, live connection status and the active-spin badge. */
export class HeaderView {
  readonly root = el('header', { className: 'header' });
  private readonly status = el('span', { className: 'status-pill' });
  private readonly spinBadge = el('span', { className: 'spin-badge hidden' });

  constructor() {
    this.root.append(
      el('div', { className: 'brand' }, [
        el('span', { className: 'brand-icon', text: '🎰' }),
        el('span', { text: 'WheelLive' }),
        el('span', { className: 'brand-sub', text: 'Panel del operador' }),
      ]),
      el('div', { className: 'header-right' }, [this.spinBadge, this.status]),
    );
  }

  update(state: PanelState): void {
    this.status.textContent = STATUS_LABELS[state.status];
    this.status.className = `status-pill status-${state.status}`;

    if (state.activeSpin) {
      this.spinBadge.textContent = `🎡 Girando: ${state.activeSpin.buyerName}`;
      this.spinBadge.classList.remove('hidden');
    } else if (state.lastResult) {
      this.spinBadge.textContent = `🏆 ${state.lastResult.buyerName} → ${state.lastResult.prizeName}`;
      this.spinBadge.classList.remove('hidden');
    } else {
      this.spinBadge.classList.add('hidden');
    }
  }
}
