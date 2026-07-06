import { button, el } from '../core/dom.js';

const STORAGE_KEY = 'wheellive.panel.token';

export function loadToken(): string {
  return localStorage.getItem(STORAGE_KEY) ?? 'dev-token';
}

export function saveToken(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

/** Shown when the server rejects the token; saves and retries. */
export class TokenDialog {
  readonly root: HTMLDialogElement;
  private readonly input = el('input', {
    attrs: { type: 'password', placeholder: 'Token del panel' },
  });

  constructor(onSubmit: (token: string) => void) {
    this.root = document.createElement('dialog');
    this.root.className = 'prize-dialog';

    const form = el('form', { attrs: { method: 'dialog' } });
    const submit = (): void => {
      const token = this.input.value.trim();
      if (token !== '') {
        saveToken(token);
        this.root.close();
        onSubmit(token);
      }
    };
    form.append(
      el('h3', { text: '🔐 Autenticación' }),
      el('p', {
        className: 'muted',
        text: 'El token no es válido. Ingresa el WHEELLIVE_PANEL_TOKEN configurado en el servidor.',
      }),
      el('label', { className: 'field' }, [el('span', { text: 'Token' }), this.input]),
      el('div', { className: 'dialog-actions' }, [button('Conectar', 'btn btn-primary', submit)]),
    );
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submit();
    });
    this.root.append(form);
  }

  open(): void {
    if (!this.root.open) {
      this.input.value = loadToken();
      this.root.showModal();
      this.input.select();
    }
  }
}
