import { normalizeCustomerName, type Customer, type QueueEntry } from '@wheellive/shared';

import { DomainError } from '../../domain/errors.js';
import { filterEligible, type EligibilityContext } from '../../domain/eligibility.js';
import { dayStart, localDayHour, monthStart, weekStart } from '../../domain/time-windows.js';
import type { Clock } from '../ports/clock.js';
import type { EventBus } from '../ports/event-bus.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { RepositorySet, UnitOfWork } from '../ports/repositories.js';

export interface QueueAddInput {
  buyerName: string;
  spins: number;
  note?: string;
  phone?: string;
  purchaseAmount?: number;
  itemsCount?: number;
  profileId?: string;
  enabledPrizeIds?: string[];
  disabledPrizeIds?: string[];
  approvals?: string[];
}

/** Read-only view of the offer state (avoids a hard OfferService dep). */
export interface OfferStateSource {
  getActive(): unknown;
}

export class QueueService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly events: EventBus,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly offers: OfferStateSource,
  ) {}

  /**
   * Registers a purchase: resolves the customer identity, evaluates every
   * eligibility rule with the purchase context, and freezes the result
   * into the entry's snapshot — all in one transaction.
   */
  async add(input: QueueAddInput): Promise<QueueEntry> {
    const now = this.clock.now();
    const entry = await this.uow.run(async (repos) => {
      const { customer, isNew } = await this.resolveCustomer(repos, input, now);

      const profiles = await repos.settings.getWheelProfiles();
      const profile =
        input.profileId === undefined
          ? undefined
          : profiles.find((candidate) => candidate.id === input.profileId);
      if (input.profileId !== undefined && profile === undefined) {
        throw new DomainError('PROFILE_NOT_FOUND', `profile "${input.profileId}" does not exist`);
      }

      const prizes = await repos.prizes.list();
      const customerAwardCounts = await repos.spins.countAwardsByCustomer(customer.id);
      const isNewCustomer =
        isNew || Object.values(customerAwardCounts).every((count) => count === 0);

      const ctx: EligibilityContext = {
        now,
        ...localDayHour(now),
        ...(input.purchaseAmount !== undefined && { purchaseAmount: input.purchaseAmount }),
        ...(input.itemsCount !== undefined && { itemsCount: input.itemsCount }),
        isNewCustomer,
        customerAwardCounts,
        prizeAwardCounts: await repos.spins.countAwardsByPrize({
          day: dayStart(now),
          week: weekStart(now),
          month: monthStart(now),
        }),
        offerActive: this.offers.getActive() !== null,
        approvals: new Set(input.approvals ?? []),
        profile,
        manualEnabled: input.enabledPrizeIds ? new Set(input.enabledPrizeIds) : undefined,
        manualDisabled: input.disabledPrizeIds ? new Set(input.disabledPrizeIds) : undefined,
      };

      const created: QueueEntry = {
        id: this.ids.next('entry'),
        buyerName: input.buyerName,
        spinsTotal: input.spins,
        spinsRemaining: input.spins,
        createdAt: now,
        customerId: customer.id,
        eligiblePrizeIds: filterEligible(prizes, ctx).map((prize) => prize.id),
        ...(input.note !== undefined && { note: input.note }),
        ...(input.purchaseAmount !== undefined && { purchaseAmount: input.purchaseAmount }),
        ...(input.itemsCount !== undefined && { itemsCount: input.itemsCount }),
        ...(input.profileId !== undefined && { profileId: input.profileId }),
      };
      await repos.queue.create(created);
      return created;
    });

    await this.publishQueue();
    return entry;
  }

  private async resolveCustomer(
    repos: RepositorySet,
    input: QueueAddInput,
    now: number,
  ): Promise<{ customer: Customer; isNew: boolean }> {
    const normalizedName = normalizeCustomerName(input.buyerName);
    const existing = await repos.customers.findByNormalizedName(normalizedName);
    if (existing) {
      if (input.phone !== undefined && existing.phone === undefined) {
        await repos.customers.setPhone(existing.id, input.phone);
      }
      return { customer: existing, isNew: false };
    }
    const customer: Customer = {
      id: this.ids.next('customer'),
      name: input.buyerName.trim(),
      normalizedName,
      firstSeenAt: now,
      ...(input.phone !== undefined && { phone: input.phone }),
    };
    await repos.customers.create(customer);
    return { customer, isNew: true };
  }

  async remove(entryId: string): Promise<void> {
    const removed = await this.uow.run((repos) => repos.queue.remove(entryId));
    if (!removed) {
      throw new DomainError('ENTRY_NOT_FOUND', `queue entry "${entryId}" does not exist`);
    }
    await this.publishQueue();
  }

  async list(): Promise<QueueEntry[]> {
    return this.uow.run((repos) => repos.queue.list());
  }

  private async publishQueue(): Promise<void> {
    const queue = await this.list();
    this.events.publish({ kind: 'queue.changed', queue });
  }
}
