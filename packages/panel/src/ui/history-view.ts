import { button, el } from '../core/dom.js';

interface HistoryItem {
  spinId: string;
  buyerName: string;
  prizeName: string;
  completedAt: number;
}

interface HistoryResponse {
  items: HistoryItem[];
  total: number;
}

interface StatsResponse {
  totalSpins: number;
  totalBuyers: number;
  prizeCounts: { prizeId: string; prizeName: string; count: number }[];
}

/** Completed spins + aggregate stats, fetched over REST. */
export class HistoryView {
  readonly root = el('section', { className: 'card' });
  private readonly statsRow = el('div', { className: 'stats-row' });
  private readonly list = el('div', { className: 'history-list' });

  constructor() {
    this.root.append(
      el('div', { className: 'card-header' }, [
        el('h2', { text: '📜 Historial' }),
        button('↻ Actualizar', 'btn btn-ghost', () => {
          void this.refresh();
        }),
      ]),
      this.statsRow,
      this.list,
    );
  }

  async refresh(): Promise<void> {
    try {
      const [historyRes, statsRes] = await Promise.all([
        fetch('/api/history?limit=15'),
        fetch('/api/stats'),
      ]);
      if (!historyRes.ok || !statsRes.ok) {
        return;
      }
      const history = (await historyRes.json()) as HistoryResponse;
      const stats = (await statsRes.json()) as StatsResponse;
      this.render(history, stats);
    } catch (error) {
      console.warn('[panel] failed to load history', error);
    }
  }

  private render(history: HistoryResponse, stats: StatsResponse): void {
    this.statsRow.replaceChildren(
      statChip('Giros totales', String(stats.totalSpins)),
      statChip('Compradores', String(stats.totalBuyers)),
      ...stats.prizeCounts
        .slice(0, 3)
        .map((entry) => statChip(entry.prizeName, `×${String(entry.count)}`)),
    );

    this.list.replaceChildren();
    if (history.items.length === 0) {
      this.list.append(el('p', { className: 'empty', text: 'Aún no hay giros completados.' }));
      return;
    }
    for (const item of history.items) {
      const time = new Date(item.completedAt).toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit',
      });
      this.list.append(
        el('div', { className: 'history-row' }, [
          el('span', { className: 'muted', text: time }),
          el('strong', { text: item.buyerName }),
          el('span', { text: item.prizeName }),
        ]),
      );
    }
  }
}

function statChip(label: string, value: string): HTMLElement {
  return el('div', { className: 'stat-chip' }, [
    el('span', { className: 'stat-value', text: value }),
    el('span', { className: 'stat-label', text: label }),
  ]);
}
