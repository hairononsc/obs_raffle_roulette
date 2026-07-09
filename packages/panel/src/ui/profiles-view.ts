import type { Prize, WheelProfile } from '@wheellive/shared';

import { button, el } from '../core/dom.js';
import type { PanelActions } from '../actions.js';
import type { PanelState } from '../state/store.js';

/** Reusable wheel profiles: list + create/edit dialog. */
export class ProfilesView {
  readonly root = el('section', { className: 'card' });
  private readonly list = el('div', { className: 'profile-list' });
  private readonly dialog = new ProfileDialog();
  private prizes: readonly Prize[] = [];

  constructor(private readonly actions: PanelActions) {
    this.root.append(
      el('div', { className: 'card-header' }, [
        el('h2', { text: '🗂 Perfiles de Ruleta' }),
        button('➕ Nuevo perfil', 'btn btn-primary', () => {
          this.dialog.open(null, this.prizes, (profile) => void this.actions.saveProfile(profile));
        }),
      ]),
      this.list,
      this.dialog.root,
    );
  }

  update(state: PanelState): void {
    this.prizes = state.prizes;
    this.list.replaceChildren();

    if (state.profiles.length === 0) {
      this.list.append(
        el('p', {
          className: 'empty',
          text: 'Sin perfiles. Crea perfiles como «Básico», «Premium» o «Black Friday» para cambiar los premios disponibles según la compra.',
        }),
      );
      return;
    }

    for (const profile of state.profiles) {
      const existingCount = profile.prizeIds.filter((id) =>
        state.prizes.some((prize) => prize.id === id),
      ).length;
      const overrides = Object.keys(profile.weightOverrides ?? {}).length;
      const summary =
        `${String(existingCount)} premio(s)` +
        (overrides > 0 ? ` · ${String(overrides)} peso(s) ajustado(s)` : '');

      this.list.append(
        el('div', { className: 'profile-row' }, [
          el('div', {}, [
            el('strong', { text: profile.name }),
            el('span', { className: 'muted', text: ` — ${summary}` }),
          ]),
          el('div', { className: 'queue-actions' }, [
            button('✏️', 'btn btn-ghost', () => {
              this.dialog.open(
                profile,
                this.prizes,
                (input) => void this.actions.saveProfile({ ...input, id: profile.id }),
              );
            }),
            button('🗑', 'btn btn-ghost', () => {
              if (confirm(`¿Eliminar el perfil "${profile.name}"?`)) {
                void this.actions.deleteProfile(profile.id);
              }
            }),
          ]),
        ]),
      );
    }
  }
}

function displayIcon(icon: string): string {
  // Theme keys (prize-*) are resolved by the widget's theme, not renderable here.
  return icon.startsWith('prize-') ? '🎁' : icon;
}

interface ProfileDraft {
  name: string;
  prizeIds: string[];
  weightOverrides?: Record<string, number>;
}

class ProfileDialog {
  readonly root: HTMLDialogElement;
  private readonly nameInput = el('input', { attrs: { maxlength: '40', required: 'true' } });
  private readonly rows = el('div', { className: 'profile-prizes' });
  private readonly includes = new Map<string, HTMLInputElement>();
  private readonly weights = new Map<string, HTMLInputElement>();
  private onSubmit: ((profile: ProfileDraft) => void) | null = null;

  constructor() {
    this.root = document.createElement('dialog');
    this.root.className = 'prize-dialog';

    const form = el('form', { attrs: { method: 'dialog' } });
    form.append(
      el('h3', { text: 'Perfil de ruleta' }),
      el('label', { className: 'field' }, [el('span', { text: 'Nombre' }), this.nameInput]),
      el('div', { className: 'muted', text: 'Incluir · Premio · Peso override (vacío = normal)' }),
      this.rows,
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

  open(
    profile: WheelProfile | null,
    prizes: readonly Prize[],
    onSubmit: (profile: ProfileDraft) => void,
  ): void {
    this.onSubmit = onSubmit;
    this.nameInput.value = profile?.name ?? '';
    this.rows.replaceChildren();
    this.includes.clear();
    this.weights.clear();

    for (const prize of prizes) {
      const include = el('input', { attrs: { type: 'checkbox' } });
      include.checked = profile?.prizeIds.includes(prize.id) ?? false;
      const weight = el('input', {
        attrs: { type: 'number', min: '0.1', step: '0.1', placeholder: `normal (${String(prize.weight)})` },
      });
      const override = profile?.weightOverrides?.[prize.id];
      weight.value = override === undefined ? '' : String(override);
      weight.disabled = !include.checked;
      include.addEventListener('change', () => {
        weight.disabled = !include.checked;
      });

      this.includes.set(prize.id, include);
      this.weights.set(prize.id, weight);
      this.rows.append(
        el('label', { className: `profile-prize-row${prize.active ? '' : ' row-inactive'}` }, [
          include,
          el('span', { text: `${displayIcon(prize.icon)} ${prize.name}${prize.active ? '' : ' (inactivo)'}` }),
          weight,
        ]),
      );
    }
    this.root.showModal();
    this.nameInput.focus();
  }

  private submit(): void {
    const name = this.nameInput.value.trim();
    if (name === '') {
      return;
    }
    const prizeIds: string[] = [];
    const weightOverrides: Record<string, number> = {};
    for (const [prizeId, include] of this.includes) {
      if (!include.checked) {
        continue;
      }
      prizeIds.push(prizeId);
      const raw = this.weights.get(prizeId)?.value.trim() ?? '';
      const value = Number.parseFloat(raw);
      if (raw !== '' && Number.isFinite(value) && value > 0) {
        weightOverrides[prizeId] = value;
      }
    }
    this.root.close();
    this.onSubmit?.({
      name,
      prizeIds,
      ...(Object.keys(weightOverrides).length > 0 && { weightOverrides }),
    });
  }
}
