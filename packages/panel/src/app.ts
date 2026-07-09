import { PanelActions } from './actions.js';
import { el } from './core/dom.js';
import { ToastCenter } from './core/toast.js';
import { PanelSocket, resolveWsUrl } from './net/panel-socket.js';
import { PanelStore } from './state/store.js';
import { ChestControlView } from './ui/chest-control-view.js';
import { HeaderView } from './ui/header-view.js';
import { HistoryView } from './ui/history-view.js';
import { OfferControlView } from './ui/offer-control-view.js';
import { PrizesView } from './ui/prizes-view.js';
import { QueueView } from './ui/queue-view.js';
import { SettingsView } from './ui/settings-view.js';
import { TabBar } from './ui/tabs.js';

/** Composition root of the panel: wires socket -> store -> views. */
export function startPanel(container: HTMLElement): void {
  const socket = new PanelSocket({ url: resolveWsUrl() });
  const store = new PanelStore();
  const toast = new ToastCenter();
  const actions = new PanelActions(socket, toast);

  const header = new HeaderView();
  const queue = new QueueView(actions);
  const prizes = new PrizesView(actions);
  const settings = new SettingsView(actions);
  const history = new HistoryView();
  const chest = new ChestControlView(actions);
  const offer = new OfferControlView(actions);

  // One pane per module. "Ruleta" keeps the two-column layout because the
  // queue and the history are what the operator watches during the live.
  const ruletaPane = el('main', { className: 'layout pane' }, [
    el('div', { className: 'column' }, [queue.root]),
    el('div', { className: 'column' }, [history.root]),
  ]);
  const chestPane = el('main', { className: 'layout layout-single pane' }, [chest.root]);
  const offerPane = el('main', { className: 'layout layout-single pane' }, [offer.root]);
  const prizesPane = el('main', { className: 'layout layout-single pane' }, [prizes.root]);
  const settingsPane = el('main', { className: 'layout layout-single pane' }, [settings.root]);

  const tabs = new TabBar([
    { id: 'ruleta', label: '🎡 Ruleta', pane: ruletaPane },
    { id: 'cofre', label: '🪙 Cofre', pane: chestPane },
    { id: 'oferta', label: '⚡ Oferta', pane: offerPane },
    { id: 'premios', label: '🎁 Premios', pane: prizesPane },
    { id: 'ajustes', label: '⚙️ Ajustes', pane: settingsPane },
  ]);

  container.append(
    header.root,
    tabs.root,
    ruletaPane,
    chestPane,
    offerPane,
    prizesPane,
    settingsPane,
  );
  toast.mount(container);

  const render = (): void => {
    header.update(store.state);
    queue.update(store.state);
    prizes.update(store.state);
    settings.update(store.state);
    chest.update(store.state);
    offer.update(store.state);

    // Tab badges: at-a-glance module status without switching tabs.
    const chestState = store.state.chest;
    tabs.setBadge(
      'cofre',
      chestState === null
        ? ''
        : chestState.status === 'unlocked'
          ? '🔓'
          : `${String(chestState.keys)}/${String(chestState.keysTarget)}`,
    );
    tabs.setBadge('oferta', store.state.flashOffer ? '● activa' : '');
    tabs.setBadge('ruleta', store.state.queue.length > 0 ? String(store.state.queue.length) : '');
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
    if (status === 'online') {
      void history.refresh();
    }
  });

  render();
  socket.connect();
}
