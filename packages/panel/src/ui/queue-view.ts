import type { Prize, WheelProfile } from '@wheellive/shared';

import { button, el } from '../core/dom.js';
import { diffPrizeSelection, summarizeEligibility } from '../logic/prize-insights.js';
import type { PanelActions } from '../actions.js';
import type { PanelState } from '../state/store.js';

function displayIcon(icon: string): string {
  // Theme keys (prize-*) are resolved by the widget's theme, not renderable here.
  return icon.startsWith('prize-') ? '🎁' : icon;
}

interface PrizeDraft {
  included: boolean;
  approved: boolean;
}

/**
 * Purchase registration form (with eligibility context: amount, items,
 * profile and per-prize adjustments) + live queue with per-entry launch
 * buttons and an eligibility chip when a snapshot excludes prizes.
 *
 * The prize-adjust checkboxes live in an internal draft Map — the DOM is
 * a projection, so re-renders on prizes.changed never lose selections.
 */
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
  private readonly amountInput = el('input', {
    attrs: { type: 'number', min: '0', step: '50', placeholder: 'Monto RD$' },
  });
  private readonly itemsInput = el('input', {
    attrs: { type: 'number', min: '1', placeholder: 'Artículos' },
  });
  private readonly profileSelect = el('select');
  private readonly adjust = el('details', { className: 'prize-adjust' });
  private readonly adjustSummary = el('summary', { text: 'Ajustar premios' });
  private readonly adjustList = el('div', { className: 'prize-adjust-list' });
  private readonly adjustWarn = el('div', { className: 'warn-inline hidden' });

  private draft = new Map<string, PrizeDraft>();
  private draftTouched = false;
  private prizes: readonly Prize[] = [];
  private profiles: readonly WheelProfile[] = [];
  private profilesSignature = '';
  private expandedEntryId: string | null = null;

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

    const context = el('div', { className: 'queue-form queue-context' });
    context.append(
      el('label', { className: 'inline-label', text: 'Monto RD$' }, [this.amountInput]),
      el('label', { className: 'inline-label', text: 'Artículos' }, [this.itemsInput]),
      el('label', { className: 'inline-label', text: 'Perfil' }, [this.profileSelect]),
    );

    this.profileSelect.addEventListener('change', () => {
      // Manual adjustments belong to the previous baseline: reset.
      this.resetDraft();
      this.renderAdjustList();
    });

    this.adjust.append(this.adjustSummary, this.adjustList, this.adjustWarn);

    this.root.append(el('h2', { text: '🛒 Cola de giros' }), form, context, this.adjust, this.list);
  }

  update(state: PanelState): void {
    this.prizes = state.prizes;
    this.profiles = state.profiles;
    this.syncProfileOptions();
    this.renderAdjustList();
    this.renderQueue(state);
  }

  // --- registration form -------------------------------------------------

  private selectedProfile(): WheelProfile | undefined {
    const id = this.profileSelect.value;
    return id === '' ? undefined : this.profiles.find((profile) => profile.id === id);
  }

  /** Baseline inclusion for a prize: profile membership, or everything. */
  private baselineIncluded(prizeId: string): boolean {
    const profile = this.selectedProfile();
    return profile ? profile.prizeIds.includes(prizeId) : true;
  }

  private resetDraft(): void {
    this.draft.clear();
    this.draftTouched = false;
  }

  private draftFor(prize: Prize): PrizeDraft {
    let entry = this.draft.get(prize.id);
    if (!entry) {
      entry = { included: this.baselineIncluded(prize.id), approved: false };
      this.draft.set(prize.id, entry);
    }
    return entry;
  }

  private syncProfileOptions(): void {
    const signature = this.profiles.map((profile) => `${profile.id}:${profile.name}`).join('|');
    if (signature === this.profilesSignature) {
      return;
    }
    this.profilesSignature = signature;
    const previous = this.profileSelect.value;
    this.profileSelect.replaceChildren(
      el('option', { text: '— sin perfil —', attrs: { value: '' } }),
    );
    for (const profile of this.profiles) {
      this.profileSelect.append(
        el('option', { text: profile.name, attrs: { value: profile.id } }),
      );
    }
    if (previous !== '' && this.profiles.some((profile) => profile.id === previous)) {
      this.profileSelect.value = previous;
    } else if (previous !== '') {
      this.profileSelect.value = '';
      this.resetDraft();
    }
  }

  private renderAdjustList(): void {
    const active = this.prizes.filter((prize) => prize.active);
    // Drop drafts of prizes that no longer exist.
    for (const id of [...this.draft.keys()]) {
      if (!active.some((prize) => prize.id === id)) {
        this.draft.delete(id);
      }
    }

    const profile = this.selectedProfile();
    this.adjustSummary.textContent = profile
      ? `Ajustar premios · base: perfil "${profile.name}"`
      : 'Ajustar premios · base: todos los premios';

    this.adjustList.replaceChildren();
    const pendingApprovals: string[] = [];
    for (const prize of active) {
      const draft = this.draftFor(prize);
      const include = el('input', { attrs: { type: 'checkbox' } });
      include.checked = draft.included;
      include.addEventListener('change', () => {
        draft.included = include.checked;
        this.draftTouched = true;
        this.renderAdjustList();
      });

      const row = el('label', { className: 'prize-adjust-row' }, [
        include,
        el('span', { text: `${displayIcon(prize.icon)} ${prize.name}` }),
      ]);

      if (prize.conditions.requiresApproval) {
        const approve = el('input', { attrs: { type: 'checkbox' } });
        approve.checked = draft.approved;
        approve.addEventListener('change', () => {
          draft.approved = approve.checked;
          this.draftTouched = true;
          this.renderAdjustList();
        });
        row.append(
          el('span', { className: 'warn-badge', text: '⚠' }),
          el('label', { className: 'inline-label approve-label' }, [approve, 'Autorizar']),
        );
        if (draft.included && !draft.approved) {
          pendingApprovals.push(prize.name);
        }
      }
      this.adjustList.append(row);
    }

    if (pendingApprovals.length > 0) {
      this.adjustWarn.textContent = `⚠ Sin autorización quedará bloqueado: ${pendingApprovals.join(', ')}`;
      this.adjustWarn.classList.remove('hidden');
    } else {
      this.adjustWarn.classList.add('hidden');
    }
  }

  private submit(): void {
    const buyerName = this.nameInput.value.trim();
    const spins = Number.parseInt(this.spinsInput.value, 10);
    if (buyerName === '' || Number.isNaN(spins) || spins < 1) {
      return;
    }

    const amount = Number.parseFloat(this.amountInput.value);
    const items = Number.parseInt(this.itemsInput.value, 10);
    const profile = this.selectedProfile();

    const activeIds = this.prizes.filter((prize) => prize.active).map((prize) => prize.id);
    const baseline = new Set(activeIds.filter((id) => this.baselineIncluded(id)));
    const selected = new Set(
      activeIds.filter((id) => this.draft.get(id)?.included ?? this.baselineIncluded(id)),
    );
    const deltas = this.draftTouched ? diffPrizeSelection(baseline, selected) : {};
    const approvals = activeIds.filter((id) => this.draft.get(id)?.approved);

    void this.actions.addBuyer({
      buyerName,
      spins,
      note: this.noteInput.value.trim(),
      ...(Number.isFinite(amount) && amount >= 0 && this.amountInput.value !== ''
        ? { purchaseAmount: amount }
        : {}),
      ...(Number.isFinite(items) && this.itemsInput.value !== '' ? { itemsCount: items } : {}),
      ...(profile !== undefined && { profileId: profile.id }),
      ...deltas,
      ...(approvals.length > 0 && { approvals }),
    });

    this.nameInput.value = '';
    this.spinsInput.value = '1';
    this.noteInput.value = '';
    this.amountInput.value = '';
    this.itemsInput.value = '';
    this.resetDraft();
    this.adjust.open = false;
    this.renderAdjustList();
    this.nameInput.focus();
  }

  // --- queue list ---------------------------------------------------------

  private renderQueue(state: PanelState): void {
    this.list.replaceChildren();
    if (state.queue.length === 0) {
      this.list.append(el('p', { className: 'empty', text: 'Sin compradores en cola.' }));
      return;
    }

    const spinning = state.activeSpin !== null;
    for (const entry of state.queue) {
      const row = el('div', { className: 'queue-row' });
      const info = el('div', { className: 'queue-info' }, [
        el('strong', { text: entry.buyerName }),
        el('span', {
          className: 'muted',
          text:
            `${String(entry.spinsRemaining)}/${String(entry.spinsTotal)} giros` +
            (entry.purchaseAmount !== undefined ? ` · RD$${String(entry.purchaseAmount)}` : '') +
            (entry.note !== undefined ? ` · ${entry.note}` : ''),
        }),
      ]);

      const summary = summarizeEligibility(entry, state.prizes, state.profiles);
      if (summary) {
        const chipText =
          summary.profileName !== null
            ? `${summary.label} · ${summary.profileName}`
            : summary.label;
        const chip = el('span', { className: 'eligibility-chip', text: chipText });
        chip.title = `Bloqueados: ${summary.blockedNames.join(', ')}`;
        chip.addEventListener('click', () => {
          this.expandedEntryId = this.expandedEntryId === entry.id ? null : entry.id;
          this.renderQueue(state);
        });
        info.append(chip);
        if (this.expandedEntryId === entry.id) {
          info.append(
            el('span', {
              className: 'muted',
              text: `Bloqueados: ${summary.blockedNames.join(', ')}`,
            }),
          );
        }
      }

      row.append(
        info,
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
}
