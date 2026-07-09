import type { ActiveSpin } from '@wheellive/shared';

import type { SpinTiming } from '../../config.js';
import { applyWeightOverrides, filterEligibleAtLaunch } from '../../domain/eligibility.js';
import { DomainError } from '../../domain/errors.js';
import { isEligible, selectPrize } from '../../domain/prize-selection.js';
import { dayStart, localDayHour, monthStart, weekStart } from '../../domain/time-windows.js';
import { createSpinAnimation } from '../../domain/spin-animation.js';
import { assertTransition } from '../../domain/spin-lifecycle.js';
import { toActiveSpin, type SpinRecord } from '../../domain/spin-record.js';
import { computeSegments } from '../../domain/wheel-layout.js';
import type { Clock } from '../ports/clock.js';
import type { EventBus } from '../ports/event-bus.js';
import type { ActiveSpinGuard } from '../ports/guards.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { RandomSource } from '../ports/random-source.js';
import type { UnitOfWork } from '../ports/repositories.js';
import type { ScheduledTask, Scheduler } from '../ports/scheduler.js';

export interface SpinServiceDeps {
  uow: UnitOfWork;
  events: EventBus;
  ids: IdGenerator;
  clock: Clock;
  rng: RandomSource;
  scheduler: Scheduler;
  timing: SpinTiming;
  /** Read-only offer state for the requiresActiveOffer dynamic rule. */
  offers: { getActive(): unknown };
}

/**
 * Owns the spin lifecycle. Exactly one spin can be active at a time; the
 * outcome is decided, stock reserved and the record persisted in a single
 * transaction BEFORE any client hears about the spin.
 */
export class SpinService implements ActiveSpinGuard {
  private active: SpinRecord | null = null;
  private timer: ScheduledTask | null = null;

  constructor(private readonly deps: SpinServiceDeps) {}

  hasActiveSpin(): boolean {
    return this.active !== null;
  }

  getActiveSpin(): ActiveSpin | null {
    return this.active === null ? null : toActiveSpin(this.active);
  }

  /** Crash recovery: a spin interrupted by a restart is already decided
   *  and paid for, so it is closed as completed, never re-run. */
  async recoverOnBoot(): Promise<number> {
    return this.deps.uow.run((repos) => repos.spins.completeAllUnfinished(this.deps.clock.now()));
  }

  async launch(entryId: string): Promise<ActiveSpin> {
    if (this.active !== null) {
      throw new DomainError('SPIN_IN_PROGRESS', 'a spin is already active');
    }

    const { record, queue, prizes, stockChanged } = await this.deps.uow.run(async (repos) => {
      const entry = await repos.queue.findById(entryId);
      if (!entry) {
        throw new DomainError('ENTRY_NOT_FOUND', `queue entry "${entryId}" does not exist`);
      }
      if (entry.spinsRemaining < 1) {
        throw new DomainError('NO_SPINS_REMAINING', `entry "${entryId}" has no spins left`);
      }

      const allPrizes = await repos.prizes.list();
      if (!allPrizes.some(isEligible)) {
        throw new DomainError('NO_STOCK_AVAILABLE', 'no active prize with stock remaining');
      }

      // Per-customer eligibility: the entry's registration snapshot plus a
      // re-check of the rules that change over time (caps, offer, schedule).
      const now = this.deps.clock.now();
      const snapshot = entry.eligiblePrizeIds ? new Set(entry.eligiblePrizeIds) : null;
      const candidates = filterEligibleAtLaunch(allPrizes, snapshot, {
        ...localDayHour(now),
        offerActive: this.deps.offers.getActive() !== null,
        customerAwardCounts: entry.customerId
          ? await repos.spins.countAwardsByCustomer(entry.customerId)
          : {},
        prizeAwardCounts: await repos.spins.countAwardsByPrize({
          day: dayStart(now),
          week: weekStart(now),
          month: monthStart(now),
        }),
      });
      if (candidates.length === 0) {
        throw new DomainError(
          'NO_ELIGIBLE_PRIZES',
          'no prize is eligible for this entry right now',
        );
      }

      const profile = entry.profileId
        ? (await repos.settings.getWheelProfiles()).find((p) => p.id === entry.profileId)
        : undefined;
      const prize = selectPrize(
        applyWeightOverrides(candidates, profile?.weightOverrides),
        () => this.deps.rng.next(),
      );
      if (!prize) {
        throw new DomainError('INTERNAL_ERROR', 'selection failed over non-empty candidates');
      }

      const segments = computeSegments(allPrizes);
      const target = segments.find((segment) => segment.prizeId === prize.id);
      if (!target) {
        throw new DomainError('INTERNAL_ERROR', 'selected prize is not on the wheel');
      }

      const settings = await repos.settings.getSpinSettings();
      const spin: SpinRecord = {
        spinId: this.deps.ids.next('spin'),
        entryId,
        buyerName: entry.buyerName,
        prizeId: prize.id,
        prizeName: prize.name,
        targetSegmentIndex: target.index,
        animation: createSpinAnimation(settings, () => this.deps.rng.next()),
        status: 'spinning',
        startedAt: this.deps.clock.now(),
        completedAt: null,
        customerId: entry.customerId ?? null,
      };

      await repos.queue.decrementRemaining(entryId);
      const reservesStock = prize.stock !== null;
      if (reservesStock) {
        await repos.prizes.decrementStock(prize.id);
      }
      await repos.spins.create(spin);

      return {
        record: spin,
        queue: await repos.queue.list(),
        prizes: await repos.prizes.list(),
        stockChanged: reservesStock,
      };
    });

    this.active = record;
    const activeSpin = toActiveSpin(record);
    if (!activeSpin) {
      throw new DomainError('INTERNAL_ERROR', 'freshly created spin is not active');
    }

    this.events.publish({ kind: 'spin.started', spin: activeSpin });
    this.events.publish({ kind: 'queue.changed', queue });
    if (stockChanged) {
      this.events.publish({ kind: 'prizes.changed', prizes, segments: computeSegments(prizes) });
    }

    // Safety net: if the widget never confirms (OBS closed, page dead),
    // the spin still completes and the queue never freezes.
    this.armTimer(record.animation.durationMs + this.deps.timing.landingGraceMs);
    return activeSpin;
  }

  /** Widget confirmed the wheel stopped on the target segment. */
  async confirmLanded(spinId: string): Promise<void> {
    const active = this.active;
    if (active?.spinId !== spinId || active.status !== 'spinning') {
      throw new DomainError('SPIN_NOT_ACTIVE', `spin "${spinId}" is not the active spinning spin`);
    }
    assertTransition(active.status, 'celebrating');
    active.status = 'celebrating';
    await this.deps.uow.run((repos) => repos.spins.updateStatus(spinId, 'celebrating', null));
    this.armTimer(this.deps.timing.celebrationMs);
  }

  private armTimer(delayMs: number): void {
    this.timer?.cancel();
    this.timer = this.deps.scheduler.schedule(delayMs, () => {
      this.complete().catch((error: unknown) => {
        console.error('[spin-service] failed to complete spin', error);
      });
    });
  }

  private async complete(): Promise<void> {
    const active = this.active;
    if (!active) {
      return;
    }
    assertTransition(active.status, 'completed');
    const completedAt = this.deps.clock.now();
    await this.deps.uow.run((repos) =>
      repos.spins.updateStatus(active.spinId, 'completed', completedAt),
    );

    this.timer?.cancel();
    this.timer = null;
    this.active = null;

    this.events.publish({
      kind: 'spin.completed',
      spinId: active.spinId,
      buyerName: active.buyerName,
      prizeId: active.prizeId,
      prizeName: active.prizeName,
      completedAt,
    });
  }

  private get events(): EventBus {
    return this.deps.events;
  }
}
