import { OFFER_DURATIONS_MS } from '@wheellive/shared';

import { button, el } from '../core/dom.js';
import type { PanelActions } from '../actions.js';
import type { PanelState } from '../state/store.js';

function durationLabel(ms: number): string {
  const minutes = ms / 60_000;
  return minutes === 1 ? '1 minuto' : `${String(minutes)} minutos`;
}

function formatMmSs(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Operator controls for the flash offer. Form while inactive; live
 * countdown + cancel while active. The countdown ticks on a private
 * interval (the store does not tick) cleaned up when the offer ends.
 */
export class OfferControlView {
  readonly root = el('section', { className: 'card' });
  private readonly form = el('div');
  private readonly active = el('div');
  private readonly titleInput = el('input', {
    attrs: { placeholder: '2x1 en jeans premium', maxlength: '60' },
  });
  private readonly descriptionInput = el('input', {
    attrs: { placeholder: 'Solo durante los próximos minutos', maxlength: '160' },
  });
  private readonly durationSelect = el('select');
  private readonly activeTitle = el('div', { className: 'offer-active-title' });
  private readonly countdown = el('div', { className: 'offer-countdown' });
  private endsAt: number | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly actions: PanelActions) {
    for (const ms of OFFER_DURATIONS_MS) {
      this.durationSelect.append(
        el('option', { text: durationLabel(ms), attrs: { value: String(ms) } }),
      );
    }
    this.durationSelect.value = String(300_000); // 5 min default

    this.form.append(
      el('div', { className: 'settings-grid' }, [
        el('label', { className: 'field' }, [el('span', { text: 'Título' }), this.titleInput]),
        el('label', { className: 'field' }, [
          el('span', { text: 'Descripción' }),
          this.descriptionInput,
        ]),
        el('label', { className: 'field' }, [
          el('span', { text: 'Duración' }),
          this.durationSelect,
        ]),
      ]),
      button('⚡ Activar oferta', 'btn btn-primary', () => {
        this.start();
      }),
    );

    this.active.append(
      this.activeTitle,
      this.countdown,
      button('✖ Cancelar oferta', 'btn btn-danger', () => {
        void this.actions.cancelOffer();
      }),
    );
    this.active.style.display = 'none';

    this.root.append(el('h2', { text: '⚡ Oferta Relámpago' }), this.form, this.active);
  }

  update(state: PanelState): void {
    const offer = state.flashOffer;
    if (offer) {
      this.form.style.display = 'none';
      this.active.style.display = '';
      this.activeTitle.textContent = offer.title;
      this.endsAt = offer.endsAt;
      this.renderCountdown();
      this.ticker ??= setInterval(() => {
        this.renderCountdown();
      }, 1000);
    } else {
      this.form.style.display = '';
      this.active.style.display = 'none';
      this.endsAt = null;
      if (this.ticker !== null) {
        clearInterval(this.ticker);
        this.ticker = null;
      }
    }
  }

  private renderCountdown(): void {
    if (this.endsAt === null) {
      return;
    }
    const remaining = this.endsAt - Date.now();
    this.countdown.textContent =
      remaining > 0 ? formatMmSs(remaining) : 'expirando…';
  }

  private start(): void {
    const title = this.titleInput.value.trim();
    const durationMs = Number.parseInt(this.durationSelect.value, 10);
    if (title === '' || Number.isNaN(durationMs)) {
      return;
    }
    void this.actions.startOffer(title, this.descriptionInput.value.trim(), durationMs);
  }
}
