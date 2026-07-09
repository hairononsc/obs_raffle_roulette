import type { FlashOffer } from '@wheellive/shared';

import { DomainError } from '../../domain/errors.js';
import type { Clock } from '../ports/clock.js';
import type { EventBus } from '../ports/event-bus.js';
import type { UnitOfWork } from '../ports/repositories.js';
import type { ScheduledTask, Scheduler } from '../ports/scheduler.js';

export interface OfferServiceDeps {
  uow: UnitOfWork;
  events: EventBus;
  clock: Clock;
  scheduler: Scheduler;
}

/**
 * Owns the flash offer lifecycle. `endsAt` (persisted) is the source of
 * truth: clients count down locally from it, and the server keeps a single
 * expiry timer as the authoritative closer — same safety-net pattern as
 * SpinService.
 */
export class OfferService {
  private active: FlashOffer | null = null;
  private timer: ScheduledTask | null = null;

  constructor(private readonly deps: OfferServiceDeps) {}

  getActive(): FlashOffer | null {
    if (this.active !== null && this.active.endsAt <= this.deps.clock.now()) {
      // Timer races: treat an overdue offer as gone even before it fires.
      return null;
    }
    return this.active;
  }

  /** Crash recovery: re-arm a still-valid offer, silently discard an
   *  expired one (no clients are connected yet to hear a broadcast). */
  async recoverOnBoot(): Promise<void> {
    const stored = await this.deps.uow.run((repos) => repos.settings.getFlashOffer());
    if (stored === null) {
      return;
    }
    const remaining = stored.endsAt - this.deps.clock.now();
    if (remaining <= 0) {
      await this.deps.uow.run((repos) => repos.settings.setFlashOffer(null));
      return;
    }
    this.active = stored;
    this.armTimer(remaining);
  }

  async start(input: { title: string; description: string; durationMs: number }): Promise<void> {
    if (this.getActive() !== null) {
      throw new DomainError('INVALID_STATE', 'a flash offer is already active');
    }
    const startedAt = this.deps.clock.now();
    const offer: FlashOffer = {
      title: input.title,
      description: input.description,
      durationMs: input.durationMs,
      startedAt,
      endsAt: startedAt + input.durationMs,
    };
    await this.deps.uow.run((repos) => repos.settings.setFlashOffer(offer));
    this.active = offer;
    this.deps.events.publish({ kind: 'offer.changed', offer, cause: 'started' });
    this.armTimer(input.durationMs);
  }

  /** Idempotent: cancelling when nothing is active (double click, or a race
   *  with the expiry timer) acks silently. */
  async cancel(): Promise<void> {
    if (this.active === null) {
      return;
    }
    await this.end('cancelled');
  }

  private async end(cause: 'cancelled' | 'expired'): Promise<void> {
    this.timer?.cancel();
    this.timer = null;
    this.active = null;
    await this.deps.uow.run((repos) => repos.settings.setFlashOffer(null));
    this.deps.events.publish({ kind: 'offer.changed', offer: null, cause });
  }

  private armTimer(delayMs: number): void {
    this.timer?.cancel();
    this.timer = this.deps.scheduler.schedule(delayMs, () => {
      this.end('expired').catch((error: unknown) => {
        console.error('[offer-service] failed to expire offer', error);
      });
    });
  }
}
