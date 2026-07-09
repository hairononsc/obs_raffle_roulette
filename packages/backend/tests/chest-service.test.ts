import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_CHEST_STATE } from '../src/domain/defaults.js';
import { ChestService } from '../src/application/services/chest-service.js';
import { createSqliteDatabase } from '../src/infrastructure/db/database.js';
import { KyselyUnitOfWork } from '../src/infrastructure/db/unit-of-work.js';
import { RecordingEventBus } from './helpers.js';

interface Context {
  uow: KyselyUnitOfWork;
  events: RecordingEventBus;
  service: ChestService;
}

function createContext(): Context {
  const uow = new KyselyUnitOfWork(createSqliteDatabase(':memory:'));
  const events = new RecordingEventBus();
  return { uow, events, service: new ChestService(uow, events) };
}

describe('ChestService', () => {
  let ctx: Context;

  beforeEach(() => {
    ctx = createContext();
  });

  it('returns the default state before any mutation', async () => {
    expect(await ctx.service.get()).toEqual(DEFAULT_CHEST_STATE);
  });

  it('addKey increments and broadcasts with cause keyAdded', async () => {
    await ctx.service.addKey();
    const [event] = ctx.events.ofKind('chest.changed');
    expect(event?.cause).toBe('keyAdded');
    expect(event?.chest).toMatchObject({ keys: 1, status: 'locked' });
  });

  it('the key that reaches the target unlocks in the same event', async () => {
    await ctx.service.configure({ prize: '👖 Jean Gratis', keysTarget: 2 });
    await ctx.service.addKey();
    await ctx.service.addKey();
    const events = ctx.events.ofKind('chest.changed');
    const last = events.at(-1);
    expect(last?.cause).toBe('keyAdded');
    expect(last?.chest).toMatchObject({ keys: 2, keysTarget: 2, status: 'unlocked' });
  });

  it('rejects addKey and removeKey while unlocked', async () => {
    await ctx.service.open();
    await expect(ctx.service.addKey()).rejects.toThrow(/INVALID_STATE|unlocked/);
    await expect(ctx.service.removeKey()).rejects.toThrow(/INVALID_STATE|unlocked/);
  });

  it('removeKey clamps at zero', async () => {
    await ctx.service.removeKey();
    const [event] = ctx.events.ofKind('chest.changed');
    expect(event?.chest.keys).toBe(0);
  });

  it('open is idempotent: the second open does not broadcast', async () => {
    await ctx.service.open();
    await ctx.service.open();
    expect(ctx.events.ofKind('chest.changed')).toHaveLength(1);
  });

  it('close preserves keys and reset clears them', async () => {
    await ctx.service.addKey();
    await ctx.service.open();
    await ctx.service.close();
    expect(await ctx.service.get()).toMatchObject({ keys: 1, status: 'locked' });
    await ctx.service.reset();
    expect(await ctx.service.get()).toMatchObject({ keys: 0, status: 'locked' });
  });

  it('configure clamps keys to the new target and never auto-unlocks', async () => {
    await ctx.service.addKey();
    await ctx.service.addKey();
    await ctx.service.addKey();
    await ctx.service.configure({ prize: '🎁 Regalo', keysTarget: 2 });
    const state = await ctx.service.get();
    expect(state).toMatchObject({ keys: 2, keysTarget: 2, status: 'locked', prize: '🎁 Regalo' });
  });

  it('persists across service instances on the same database', async () => {
    await ctx.service.addKey();
    await ctx.service.addKey();
    const second = new ChestService(ctx.uow, new RecordingEventBus());
    expect(await second.get()).toMatchObject({ keys: 2 });
  });
});
