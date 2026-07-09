import { LIVE_DURATIONS_MS, OFFER_DURATIONS_MS } from '@wheellive/shared';

import { button, el } from '../core/dom.js';
import type { PanelActions } from '../actions.js';
import type { PanelState } from '../state/store.js';

function offerDurationLabel(ms: number): string {
  const minutes = ms / 60_000;
  return minutes === 1 ? '1 minuto' : `${String(minutes)} minutos`;
}

function liveDurationLabel(ms: number): string {
  const hours = ms / 3_600_000;
  return `${String(hours)} h`;
}

/**
 * Pool of saved offers + the automatic program that fires them at random
 * times within the live window. "próxima ≈ HH:MM" formats the server's
 * epoch with the local clock — no ticker needed; each broadcast
 * re-renders it.
 */
export class OfferProgramView {
  readonly root = el('section', { className: 'card' });
  private readonly poolList = el('div', { className: 'pool-list' });
  private readonly titleInput = el('input', {
    attrs: { placeholder: '2x1 en jeans premium', maxlength: '60' },
  });
  private readonly descriptionInput = el('input', {
    attrs: { placeholder: 'Descripción corta (opcional)', maxlength: '160' },
  });
  private readonly durationSelect = el('select');
  private readonly liveDurationSelect = el('select');
  private readonly countInput = el('input', {
    attrs: { type: 'number', min: '1', max: '10', value: '4' },
  });
  private readonly startBtn: HTMLButtonElement;
  private readonly programForm = el('div');
  private readonly programActive = el('div');
  private readonly programStatus = el('div', { className: 'program-status' });

  constructor(private readonly actions: PanelActions) {
    for (const ms of OFFER_DURATIONS_MS) {
      this.durationSelect.append(
        el('option', { text: offerDurationLabel(ms), attrs: { value: String(ms) } }),
      );
    }
    this.durationSelect.value = String(600_000); // 10 min default

    for (const ms of LIVE_DURATIONS_MS) {
      this.liveDurationSelect.append(
        el('option', { text: liveDurationLabel(ms), attrs: { value: String(ms) } }),
      );
    }
    this.liveDurationSelect.value = String(10_800_000); // 3 h default

    this.startBtn = button('▶ Iniciar programa', 'btn btn-primary', () => {
      this.start();
    });

    this.programForm.append(
      el('div', { className: 'settings-grid' }, [
        el('label', { className: 'field' }, [
          el('span', { text: 'Duración del live' }),
          this.liveDurationSelect,
        ]),
        el('label', { className: 'field' }, [
          el('span', { text: 'Cantidad de ofertas' }),
          this.countInput,
        ]),
      ]),
      this.startBtn,
    );

    this.programActive.append(
      this.programStatus,
      button('⏹ Detener programa', 'btn btn-danger', () => {
        void this.actions.stopOfferProgram();
      }),
    );
    this.programActive.style.display = 'none';

    this.root.append(
      el('h2', { text: '🗓 Programa de Ofertas' }),
      el('p', {
        className: 'muted',
        text: 'Guarda ofertas en el pool; el programa dispara una al azar en horarios aleatorios durante el live.',
      }),
      this.poolList,
      el('div', { className: 'settings-grid pool-form' }, [
        el('label', { className: 'field' }, [el('span', { text: 'Título' }), this.titleInput]),
        el('label', { className: 'field' }, [
          el('span', { text: 'Descripción' }),
          this.descriptionInput,
        ]),
        el('label', { className: 'field' }, [
          el('span', { text: 'Duración de la oferta' }),
          this.durationSelect,
        ]),
      ]),
      button('＋ Guardar oferta', 'btn', () => {
        this.addTemplate();
      }),
      el('hr', { className: 'divider' }),
      this.programForm,
      this.programActive,
    );
  }

  update(state: PanelState): void {
    // Pool list: full re-render (small list, no inputs inside).
    this.poolList.replaceChildren();
    if (state.offerPool.length === 0) {
      this.poolList.append(el('p', { className: 'empty', text: 'Pool vacío — guarda al menos una oferta.' }));
    }
    for (const template of state.offerPool) {
      this.poolList.append(
        el('div', { className: 'pool-row' }, [
          el('span', { text: `${template.title} · ${String(template.durationMs / 60_000)} min` }),
          button('🗑', 'btn btn-ghost', () => {
            void this.actions.removeOfferTemplate(template.id);
          }),
        ]),
      );
    }

    const program = state.offerProgram;
    if (program) {
      this.programForm.style.display = 'none';
      this.programActive.style.display = '';
      const next = program.fireAt[0];
      const nextLabel =
        next === undefined
          ? '—'
          : new Date(next).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.programStatus.textContent = `Programa activo — próxima ≈ ${nextLabel} · quedan ${String(program.fireAt.length)} de ${String(program.totalCount)}`;
    } else {
      this.programForm.style.display = '';
      this.programActive.style.display = 'none';
      this.startBtn.disabled = state.offerPool.length === 0;
    }
  }

  private addTemplate(): void {
    const title = this.titleInput.value.trim();
    const durationMs = Number.parseInt(this.durationSelect.value, 10);
    if (title === '' || Number.isNaN(durationMs)) {
      return;
    }
    void this.actions.addOfferTemplate({
      title,
      description: this.descriptionInput.value.trim(),
      durationMs,
    });
    this.titleInput.value = '';
    this.descriptionInput.value = '';
  }

  private start(): void {
    const liveDurationMs = Number.parseInt(this.liveDurationSelect.value, 10);
    const offerCount = Number.parseInt(this.countInput.value, 10);
    if (Number.isNaN(liveDurationMs) || Number.isNaN(offerCount) || offerCount < 1) {
      return;
    }
    void this.actions.startOfferProgram(liveDurationMs, Math.min(offerCount, 10));
  }
}
