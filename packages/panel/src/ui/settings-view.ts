import { button, el } from '../core/dom.js';
import type { PanelActions } from '../actions.js';
import type { PanelState } from '../state/store.js';

const KNOWN_THEMES = ['casino', 'navidad'];

/** Spin timing + theme controls. Saved explicitly, never on keystroke. */
export class SettingsView {
  readonly root = el('section', { className: 'card' });
  private readonly duration = el('input', {
    attrs: { type: 'range', min: '3000', max: '20000', step: '500' },
  });
  private readonly durationLabel = el('span', { className: 'muted' });
  private readonly rotationsMin = el('input', { attrs: { type: 'number', min: '1', max: '20' } });
  private readonly rotationsMax = el('input', { attrs: { type: 'number', min: '1', max: '20' } });
  private readonly themeSelect = el('select');
  private currentThemeId = 'casino';

  constructor(private readonly actions: PanelActions) {
    this.duration.addEventListener('input', () => {
      this.updateDurationLabel();
    });

    for (const themeId of KNOWN_THEMES) {
      this.themeSelect.append(el('option', { text: themeId, attrs: { value: themeId } }));
    }
    this.themeSelect.addEventListener('change', () => {
      void this.actions.setTheme(this.themeSelect.value);
    });

    this.root.append(
      el('h2', { text: '⚙️ Ajustes' }),
      el('div', { className: 'settings-grid' }, [
        el('label', { className: 'field' }, [
          el('span', { text: 'Duración del giro' }),
          this.duration,
          this.durationLabel,
        ]),
        el('label', { className: 'field' }, [
          el('span', { text: 'Vueltas extra (mín/máx)' }),
          el('div', { className: 'field-pair' }, [this.rotationsMin, this.rotationsMax]),
        ]),
        el('label', { className: 'field' }, [
          el('span', { text: 'Tema visual' }),
          this.themeSelect,
        ]),
      ]),
      button('💾 Guardar ajustes', 'btn btn-primary', () => {
        this.save();
      }),
    );
  }

  update(state: PanelState): void {
    if (state.settings && document.activeElement !== this.duration) {
      this.duration.value = String(state.settings.durationMs);
      this.rotationsMin.value = String(state.settings.extraRotations.min);
      this.rotationsMax.value = String(state.settings.extraRotations.max);
      this.updateDurationLabel();
    }
    if (state.themeId !== this.currentThemeId) {
      this.currentThemeId = state.themeId;
      if (!KNOWN_THEMES.includes(state.themeId)) {
        this.themeSelect.append(
          el('option', { text: state.themeId, attrs: { value: state.themeId } }),
        );
      }
      this.themeSelect.value = state.themeId;
    }
  }

  private updateDurationLabel(): void {
    this.durationLabel.textContent = `${(Number(this.duration.value) / 1000).toFixed(1)} s`;
  }

  private save(): void {
    const min = Number.parseInt(this.rotationsMin.value, 10);
    const max = Number.parseInt(this.rotationsMax.value, 10);
    if (Number.isNaN(min) || Number.isNaN(max) || min < 1 || max < min) {
      return;
    }
    void this.actions.saveSettings({
      durationMs: Number.parseInt(this.duration.value, 10),
      extraRotations: { min, max },
    });
  }
}
