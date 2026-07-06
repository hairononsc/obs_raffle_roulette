import { PanelActions } from './actions.js';
import { el } from './core/dom.js';
import { ToastCenter } from './core/toast.js';
import { PanelSocket, resolveWsUrl } from './net/panel-socket.js';
import { PanelStore } from './state/store.js';
import { HeaderView } from './ui/header-view.js';
import { HistoryView } from './ui/history-view.js';
import { PrizesView } from './ui/prizes-view.js';
import { QueueView } from './ui/queue-view.js';
import { SettingsView } from './ui/settings-view.js';
import { TokenDialog, loadToken } from './ui/token-dialog.js';

/** Composition root of the panel: wires socket -> store -> views. */
export function startPanel(container: HTMLElement): void {
  let token = loadToken();
  const socket = new PanelSocket({ url: resolveWsUrl(), getToken: () => token });
  const store = new PanelStore();
  const toast = new ToastCenter();
  const actions = new PanelActions(socket, toast);

  const header = new HeaderView();
  const queue = new QueueView(actions);
  const prizes = new PrizesView(actions);
  const settings = new SettingsView(actions);
  const history = new HistoryView();
  const tokenDialog = new TokenDialog((newToken) => {
    token = newToken;
    socket.retry();
  });

  container.append(
    header.root,
    el('main', { className: 'layout' }, [
      el('div', { className: 'column' }, [queue.root, settings.root]),
      el('div', { className: 'column' }, [prizes.root, history.root]),
    ]),
    tokenDialog.root,
  );
  toast.mount(container);

  const render = (): void => {
    header.update(store.state);
    queue.update(store.state);
    prizes.update(store.state);
    settings.update(store.state);
  };
  store.subscribe(render);

  socket.events.on('message', (message) => {
    store.apply(message);
    if (message.type === 'spin.completed') {
      void history.refresh();
    }
  });
  socket.events.on('status', (status) => {
    store.setStatus(status);
    if (status === 'unauthorized') {
      tokenDialog.open();
    }
    if (status === 'online') {
      void history.refresh();
    }
  });

  render();
  socket.connect();
}
