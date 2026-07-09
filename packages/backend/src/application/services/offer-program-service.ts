import type { OfferProgramState, OfferTemplateInput } from '@wheellive/shared';

import { DomainError } from '../../domain/errors.js';
import { planOfferSchedule } from '../../domain/offer-schedule.js';
import type { Clock } from '../ports/clock.js';
import type { EventBus, OfferProgramChangeCause } from '../ports/event-bus.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { RandomSource } from '../ports/random-source.js';
import type { UnitOfWork } from '../ports/repositories.js';
import type { ScheduledTask, Scheduler } from '../ports/scheduler.js';
import type { OfferService } from './offer-service.js';

const MAX_POOL_SIZE = 50;

export interface OfferProgramServiceDeps {
  uow: UnitOfWork;
  events: EventBus;
  clock: Clock;
  scheduler: Scheduler;
  rng: RandomSource;
  ids: IdGenerator;
  offers: OfferService;
}

/**
 * Owns the offer template pool and the offer program: random pool offers
 * fired at pre-planned random times within the live window, by composing
 * the existing OfferService (the widget needs no changes).
 *
 * Collisions resolve by silent skip: if a manual offer is running (or the
 * pool was emptied) when a slot fires, the slot is consumed and the
 * program moves on — an active offer is already doing the job.
 */
export class OfferProgramService {
  private program: OfferProgramState | null = null;
  private timer: ScheduledTask | null = null;

  constructor(private readonly deps: OfferProgramServiceDeps) {}

  getState(): OfferProgramState | null {
    return this.program;
  }

  async addTemplate(input: OfferTemplateInput): Promise<void> {
    const pool = await this.deps.uow.run(async (repos) => {
      const current = await repos.settings.getOfferPool();
      if (current.length >= MAX_POOL_SIZE) {
        throw new DomainError('INVALID_STATE', 'the offer pool is full');
      }
      const next = [...current, { id: this.deps.ids.next('offer-tpl'), ...input }];
      await repos.settings.setOfferPool(next);
      return next;
    });
    this.deps.events.publish({ kind: 'offer.pool.changed', pool });
  }

  /** Removing a template that no longer exists acks silently. */
  async removeTemplate(templateId: string): Promise<void> {
    const pool = await this.deps.uow.run(async (repos) => {
      const current = await repos.settings.getOfferPool();
      const next = current.filter((template) => template.id !== templateId);
      if (next.length === current.length) {
        return null;
      }
      await repos.settings.setOfferPool(next);
      return next;
    });
    if (pool !== null) {
      this.deps.events.publish({ kind: 'offer.pool.changed', pool });
    }
  }

  async start(input: { liveDurationMs: number; offerCount: number }): Promise<void> {
    if (this.program !== null) {
      throw new DomainError('INVALID_STATE', 'an offer program is already active');
    }
    const pool = await this.deps.uow.run((repos) => repos.settings.getOfferPool());
    if (pool.length === 0) {
      throw new DomainError('INVALID_STATE', 'the offer pool is empty');
    }

    const now = this.deps.clock.now();
    const fireAt = planOfferSchedule(
      { now, windowMs: input.liveDurationMs, count: input.offerCount },
      () => this.deps.rng.next(),
    );
    if (fireAt.length === 0) {
      throw new DomainError('INVALID_STATE', 'the live window is too short for a program');
    }

    const state: OfferProgramState = {
      startedAt: now,
      endsAt: now + input.liveDurationMs,
      fireAt,
      totalCount: fireAt.length, // already clamped: what will really fire
    };
    await this.deps.uow.run((repos) => repos.settings.setOfferProgram(state));
    this.program = state;
    this.publish(state, 'started');
    this.armNext();
  }

  /** Idempotent: stopping without an active program acks silently. */
  async stop(): Promise<void> {
    if (this.program === null) {
      return;
    }
    this.timer?.cancel();
    this.timer = null;
    this.program = null;
    await this.deps.uow.run((repos) => repos.settings.setOfferProgram(null));
    this.publish(null, 'stopped');
  }

  /** Crash recovery: drop fire times missed during downtime (never fire
   *  late into a live that moved on), re-arm the next future one, and
   *  clear everything if the live window already ended. Publishes nothing
   *  — reconnecting clients get the state via state.sync. */
  async recoverOnBoot(): Promise<void> {
    const stored = await this.deps.uow.run((repos) => repos.settings.getOfferProgram());
    if (stored === null) {
      return;
    }
    const now = this.deps.clock.now();
    const future = stored.fireAt.filter((time) => time > now);
    if (future.length === 0 || stored.endsAt <= now) {
      await this.deps.uow.run((repos) => repos.settings.setOfferProgram(null));
      return;
    }
    const recovered = { ...stored, fireAt: future };
    if (future.length !== stored.fireAt.length) {
      await this.deps.uow.run((repos) => repos.settings.setOfferProgram(recovered));
    }
    this.program = recovered;
    this.armNext();
  }

  private armNext(): void {
    this.timer?.cancel();
    this.timer = null;
    const next = this.program?.fireAt[0];
    if (next === undefined) {
      return;
    }
    const delay = Math.max(0, next - this.deps.clock.now());
    this.timer = this.deps.scheduler.schedule(delay, () => {
      this.fire().catch((error: unknown) => {
        console.error('[offer-program] failed to fire scheduled offer', error);
      });
    });
  }

  private async fire(): Promise<void> {
    const program = this.program;
    if (program === null) {
      return; // Raced with stop().
    }

    // The pool is re-read at fire time so mid-live edits take effect.
    const pool = await this.deps.uow.run((repos) => repos.settings.getOfferPool());
    if (pool.length > 0) {
      const index = Math.min(Math.floor(this.deps.rng.next() * pool.length), pool.length - 1);
      const template = pool[index];
      if (template) {
        try {
          await this.deps.offers.start({
            title: template.title,
            description: template.description,
            durationMs: template.durationMs,
          });
        } catch (error) {
          if (!(error instanceof DomainError && error.code === 'INVALID_STATE')) {
            throw error;
          }
          // A manual offer is running: skip this slot silently.
        }
      }
    }

    const rest = program.fireAt.slice(1);
    if (rest.length === 0) {
      this.program = null;
      await this.deps.uow.run((repos) => repos.settings.setOfferProgram(null));
      this.publish(null, 'finished');
      return;
    }
    const advanced = { ...program, fireAt: rest };
    this.program = advanced;
    await this.deps.uow.run((repos) => repos.settings.setOfferProgram(advanced));
    this.publish(advanced, 'advanced');
    this.armNext();
  }

  private publish(program: OfferProgramState | null, cause: OfferProgramChangeCause): void {
    this.deps.events.publish({ kind: 'offer.program.changed', program, cause });
  }
}
