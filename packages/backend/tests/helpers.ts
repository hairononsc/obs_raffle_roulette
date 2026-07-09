import type { Prize, QueueEntry } from '@wheellive/shared';

import type { Clock } from '../src/application/ports/clock.js';
import type { DomainEvent, EventBus } from '../src/application/ports/event-bus.js';
import type { IdGenerator } from '../src/application/ports/id-generator.js';
import type { RandomSource } from '../src/application/ports/random-source.js';
import type { UnitOfWork } from '../src/application/ports/repositories.js';
import type { ScheduledTask, Scheduler } from '../src/application/ports/scheduler.js';
import { SimpleEventBus } from '../src/infrastructure/runtime/simple-event-bus.js';

export class FixedClock implements Clock {
  constructor(private value = 1_730_000_000_000) {}

  now(): number {
    return this.value;
  }

  advance(ms: number): void {
    this.value += ms;
  }
}

/** Returns queued values in order, then falls back to 0.5. */
export class SequenceRandom implements RandomSource {
  constructor(private readonly values: number[] = []) {}

  next(): number {
    return this.values.shift() ?? 0.5;
  }
}

export class SequentialIds implements IdGenerator {
  private counter = 0;

  next(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${String(this.counter).padStart(3, '0')}`;
  }
}

interface PendingTask {
  fn: () => void;
  delayMs: number;
  cancelled: boolean;
}

/** Tasks run only when the test says so — no real timers, no flakiness. */
export class ManualScheduler implements Scheduler {
  readonly pending: PendingTask[] = [];

  schedule(delayMs: number, fn: () => void): ScheduledTask {
    const task: PendingTask = { fn, delayMs, cancelled: false };
    this.pending.push(task);
    return {
      cancel: () => {
        task.cancelled = true;
      },
    };
  }

  async runPending(): Promise<void> {
    const tasks = this.pending.splice(0);
    for (const task of tasks) {
      if (!task.cancelled) {
        task.fn();
      }
    }
    // Scheduled callbacks kick off async completions; let them settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export class RecordingEventBus implements EventBus {
  readonly published: DomainEvent[] = [];
  private readonly inner = new SimpleEventBus();

  publish(event: DomainEvent): void {
    this.published.push(event);
    this.inner.publish(event);
  }

  subscribe(handler: (event: DomainEvent) => void): () => void {
    return this.inner.subscribe(handler);
  }

  ofKind<K extends DomainEvent['kind']>(kind: K): Extract<DomainEvent, { kind: K }>[] {
    return this.published.filter((event): event is Extract<DomainEvent, { kind: K }> => {
      return event.kind === kind;
    });
  }
}

export function testPrize(overrides: Partial<Prize> & Pick<Prize, 'id'>): Prize {
  return {
    name: `Prize ${overrides.id}`,
    weight: 1,
    stock: null,
    color: '#123456',
    icon: 'icon-test',
    active: true,
    cost: 0,
    conditions: {},
    respin: false,
    ...overrides,
  };
}

export async function insertPrizes(
  uow: UnitOfWork,
  clock: Clock,
  prizes: readonly Prize[],
): Promise<void> {
  await uow.run(async (repos) => {
    // Stagger created_at so wheel order always matches array order.
    for (const [index, prize] of prizes.entries()) {
      await repos.prizes.create(prize, clock.now() + index);
    }
  });
}

export async function insertQueueEntry(
  uow: UnitOfWork,
  entry: Partial<QueueEntry> & Pick<QueueEntry, 'id'>,
): Promise<QueueEntry> {
  const full: QueueEntry = {
    buyerName: 'Carlos',
    spinsTotal: 3,
    spinsRemaining: 3,
    createdAt: 1_730_000_000_000,
    ...entry,
  };
  await uow.run((repos) => repos.queue.create(full));
  return full;
}
