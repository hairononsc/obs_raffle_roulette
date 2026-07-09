import type {
  ChestCloseMessage,
  ChestConfigureMessage,
  ChestKeyAddMessage,
  ChestKeyRemoveMessage,
  ChestOpenMessage,
  ChestResetMessage,
  OfferCancelMessage,
  OfferPoolAddMessage,
  OfferPoolRemoveMessage,
  OfferProgramStartMessage,
  OfferProgramStopMessage,
  OfferStartMessage,
  OfferTemplateInput,
  PrizeCreateMessage,
  PrizeDeleteMessage,
  PrizeInput,
  PrizeUpdateMessage,
  QueueAddMessage,
  QueueRemoveMessage,
  SettingsUpdateMessage,
  SpinLaunchMessage,
  SpinSettings,
  ThemeSetMessage,
} from '@wheellive/shared';

import { PanelRequestError, type PanelSocket } from './net/panel-socket.js';
import type { ToastCenter } from './core/toast.js';

/**
 * All operator commands. Every action reports its outcome through toasts;
 * views never talk to the socket directly.
 */
export class PanelActions {
  constructor(
    private readonly socket: PanelSocket,
    private readonly toast: ToastCenter,
  ) {}

  async addBuyer(buyerName: string, spins: number, note: string): Promise<void> {
    await this.exec(
      () =>
        this.socket.request<QueueAddMessage>('queue.add', {
          buyerName,
          spins,
          ...(note !== '' && { note }),
        }),
      `${buyerName} agregado con ${String(spins)} giro(s)`,
    );
  }

  async removeEntry(entryId: string): Promise<void> {
    await this.exec(() => this.socket.request<QueueRemoveMessage>('queue.remove', { entryId }));
  }

  async launchSpin(entryId: string): Promise<void> {
    await this.exec(() => this.socket.request<SpinLaunchMessage>('spin.launch', { entryId }));
  }

  async createPrize(prize: PrizeInput): Promise<void> {
    await this.exec(
      () => this.socket.request<PrizeCreateMessage>('prize.create', { prize }),
      'Premio creado',
    );
  }

  async updatePrize(prizeId: string, patch: Partial<PrizeInput>): Promise<void> {
    await this.exec(
      () => this.socket.request<PrizeUpdateMessage>('prize.update', { prizeId, patch }),
      'Premio actualizado',
    );
  }

  async deletePrize(prizeId: string): Promise<void> {
    await this.exec(
      () => this.socket.request<PrizeDeleteMessage>('prize.delete', { prizeId }),
      'Premio eliminado',
    );
  }

  async saveSettings(settings: SpinSettings): Promise<void> {
    await this.exec(
      () => this.socket.request<SettingsUpdateMessage>('settings.update', { settings }),
      'Ajustes guardados',
    );
  }

  async setTheme(themeId: string): Promise<void> {
    await this.exec(
      () => this.socket.request<ThemeSetMessage>('theme.set', { themeId }),
      `Tema "${themeId}" aplicado`,
    );
  }

  async addChestKey(): Promise<void> {
    await this.exec(() => this.socket.request<ChestKeyAddMessage>('chest.key.add', {}));
  }

  async removeChestKey(): Promise<void> {
    await this.exec(() => this.socket.request<ChestKeyRemoveMessage>('chest.key.remove', {}));
  }

  async openChest(): Promise<void> {
    await this.exec(() => this.socket.request<ChestOpenMessage>('chest.open', {}));
  }

  async closeChest(): Promise<void> {
    await this.exec(() => this.socket.request<ChestCloseMessage>('chest.close', {}));
  }

  async resetChest(): Promise<void> {
    await this.exec(
      () => this.socket.request<ChestResetMessage>('chest.reset', {}),
      'Cofre reiniciado',
    );
  }

  async configureChest(prize: string, keysTarget: number): Promise<void> {
    await this.exec(
      () => this.socket.request<ChestConfigureMessage>('chest.configure', { prize, keysTarget }),
      'Cofre configurado',
    );
  }

  async startOffer(title: string, description: string, durationMs: number): Promise<void> {
    await this.exec(
      () => this.socket.request<OfferStartMessage>('offer.start', { title, description, durationMs }),
      'Oferta relámpago activada',
    );
  }

  async cancelOffer(): Promise<void> {
    await this.exec(
      () => this.socket.request<OfferCancelMessage>('offer.cancel', {}),
      'Oferta cancelada',
    );
  }

  async addOfferTemplate(template: OfferTemplateInput): Promise<void> {
    await this.exec(
      () => this.socket.request<OfferPoolAddMessage>('offer.pool.add', { template }),
      'Oferta guardada en el pool',
    );
  }

  async removeOfferTemplate(templateId: string): Promise<void> {
    await this.exec(
      () => this.socket.request<OfferPoolRemoveMessage>('offer.pool.remove', { templateId }),
      'Oferta eliminada del pool',
    );
  }

  async startOfferProgram(liveDurationMs: number, offerCount: number): Promise<void> {
    await this.exec(
      () =>
        this.socket.request<OfferProgramStartMessage>('offer.program.start', {
          liveDurationMs,
          offerCount,
        }),
      'Programa de ofertas iniciado',
    );
  }

  async stopOfferProgram(): Promise<void> {
    await this.exec(
      () => this.socket.request<OfferProgramStopMessage>('offer.program.stop', {}),
      'Programa detenido',
    );
  }

  private async exec(command: () => Promise<void>, successMessage?: string): Promise<void> {
    try {
      await command();
      if (successMessage !== undefined) {
        this.toast.success(successMessage);
      }
    } catch (error) {
      this.toast.error(describeError(error));
    }
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  SPIN_IN_PROGRESS: 'Ya hay un giro en curso',
  NO_STOCK_AVAILABLE: 'Ningún premio tiene inventario disponible',
  NO_SPINS_REMAINING: 'Este comprador ya no tiene giros',
  ENTRY_NOT_FOUND: 'El comprador ya no está en la cola',
  PRIZE_NOT_FOUND: 'El premio ya no existe',
  INVALID_STATE: 'Acción no permitida en el estado actual',
  OFFLINE: 'Sin conexión con el servidor',
  TIMEOUT: 'El servidor no respondió',
};

function describeError(error: unknown): string {
  if (error instanceof PanelRequestError) {
    return ERROR_MESSAGES[error.code] ?? error.message;
  }
  return 'Error inesperado';
}
