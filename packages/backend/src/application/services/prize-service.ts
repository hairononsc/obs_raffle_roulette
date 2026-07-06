import type { Prize, PrizeInput } from '@wheellive/shared';

import { DomainError } from '../../domain/errors.js';
import { computeSegments } from '../../domain/wheel-layout.js';
import type { Clock } from '../ports/clock.js';
import type { EventBus } from '../ports/event-bus.js';
import type { ActiveSpinGuard } from '../ports/guards.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { UnitOfWork } from '../ports/repositories.js';

export class PrizeService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly events: EventBus,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly activeSpin: ActiveSpinGuard,
  ) {}

  async create(input: PrizeInput): Promise<Prize> {
    this.assertMutable();
    const prize: Prize = { id: this.ids.next('prize'), ...input };
    await this.uow.run((repos) => repos.prizes.create(prize, this.clock.now()));
    await this.publishPrizes();
    return prize;
  }

  async update(prizeId: string, patch: Partial<PrizeInput>): Promise<Prize> {
    this.assertMutable();
    const updated = await this.uow.run(async (repos) => {
      const current = await repos.prizes.findById(prizeId);
      if (!current) {
        throw new DomainError('PRIZE_NOT_FOUND', `prize "${prizeId}" does not exist`);
      }
      const next: Prize = { ...current, ...patch };
      await repos.prizes.update(next);
      return next;
    });
    await this.publishPrizes();
    return updated;
  }

  async remove(prizeId: string): Promise<void> {
    this.assertMutable();
    const removed = await this.uow.run((repos) => repos.prizes.remove(prizeId));
    if (!removed) {
      throw new DomainError('PRIZE_NOT_FOUND', `prize "${prizeId}" does not exist`);
    }
    await this.publishPrizes();
  }

  async list(): Promise<Prize[]> {
    return this.uow.run((repos) => repos.prizes.list());
  }

  /**
   * Changing prizes mid-spin would change the segment layout while the
   * wheel is animating toward an index of the old layout. Blocked outright.
   */
  private assertMutable(): void {
    if (this.activeSpin.hasActiveSpin()) {
      throw new DomainError('INVALID_STATE', 'prizes cannot be modified while a spin is active');
    }
  }

  private async publishPrizes(): Promise<void> {
    const prizes = await this.list();
    this.events.publish({ kind: 'prizes.changed', prizes, segments: computeSegments(prizes) });
  }
}
