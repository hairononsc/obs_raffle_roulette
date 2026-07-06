import type { QueueEntry } from '@wheellive/shared';

import { DomainError } from '../../domain/errors.js';
import type { Clock } from '../ports/clock.js';
import type { EventBus } from '../ports/event-bus.js';
import type { IdGenerator } from '../ports/id-generator.js';
import type { UnitOfWork } from '../ports/repositories.js';

export interface QueueAddInput {
  buyerName: string;
  spins: number;
  note?: string;
}

export class QueueService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly events: EventBus,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async add(input: QueueAddInput): Promise<QueueEntry> {
    const entry: QueueEntry = {
      id: this.ids.next('entry'),
      buyerName: input.buyerName,
      spinsTotal: input.spins,
      spinsRemaining: input.spins,
      createdAt: this.clock.now(),
      ...(input.note !== undefined && { note: input.note }),
    };
    await this.uow.run((repos) => repos.queue.create(entry));
    await this.publishQueue();
    return entry;
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
