import { el } from './dom.js';

const TOAST_DURATION_MS = 3500;

/** Bottom-right notification stack for command feedback. */
export class ToastCenter {
  private readonly container = el('div', { className: 'toasts' });

  mount(parent: HTMLElement): void {
    parent.append(this.container);
  }

  success(message: string): void {
    this.show(message, 'toast-success');
  }

  error(message: string): void {
    this.show(message, 'toast-error');
  }

  private show(message: string, kind: string): void {
    const toast = el('div', { className: `toast ${kind}`, text: message });
    this.container.append(toast);
    setTimeout(() => {
      toast.remove();
    }, TOAST_DURATION_MS);
  }
}
