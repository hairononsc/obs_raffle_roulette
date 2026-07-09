import { createMessage, type StateSyncMessage, type ServerMessage } from '@wheellive/shared';
import { describe, expect, it } from 'vitest';

import { PanelStore, winProbability } from '../src/state/store.js';

const SYNC_PAYLOAD: StateSyncMessage['payload'] = {
  settings: { durationMs: 8000, extraRotations: { min: 4, max: 7 } },
  themeId: 'casino',
  prizes: [
    { id: 'a', name: 'A', weight: 1, stock: 5, color: '#111111', icon: 'x', active: true },
    { id: 'b', name: 'B', weight: 3, stock: null, color: '#222222', icon: 'x', active: true },
  ],
  segments: [],
  queue: [{ id: 'e1', buyerName: 'Carlos', spinsTotal: 2, spinsRemaining: 2, createdAt: 1 }],
  activeSpin: null,
  chest: { keys: 2, keysTarget: 5, prize: '👖 Jean Gratis', status: 'locked' },
  flashOffer: null,
  offerPool: [{ id: 'tpl-1', title: '2x1', description: '', durationMs: 600_000 }],
  offerProgram: null,
};

function sync(): ServerMessage {
  return createMessage<StateSyncMessage>('state.sync', SYNC_PAYLOAD);
}

describe('PanelStore', () => {
  it('rebuilds everything from state.sync', () => {
    const store = new PanelStore();
    store.apply(sync());
    expect(store.state.prizes).toHaveLength(2);
    expect(store.state.queue[0]?.buyerName).toBe('Carlos');
    expect(store.state.settings?.durationMs).toBe(8000);
    expect(store.state.themeId).toBe('casino');
    expect(store.state.chest).toMatchObject({ keys: 2, status: 'locked' });
    expect(store.state.flashOffer).toBeNull();
  });

  it('applies chest.changed and offer.changed broadcasts', () => {
    const store = new PanelStore();
    store.apply(sync());

    store.apply(
      createMessage('chest.changed', {
        chest: { keys: 5, keysTarget: 5, prize: '👖 Jean Gratis', status: 'unlocked' },
        cause: 'keyAdded',
      }),
    );
    expect(store.state.chest?.status).toBe('unlocked');

    const offer = {
      title: '2x1',
      description: '',
      durationMs: 60_000,
      startedAt: 1_000,
      endsAt: 61_000,
    };
    store.apply(createMessage('offer.changed', { offer, cause: 'started' }));
    expect(store.state.flashOffer?.title).toBe('2x1');

    store.apply(createMessage('offer.changed', { offer: null, cause: 'expired' }));
    expect(store.state.flashOffer).toBeNull();
  });

  it('applies offer pool and program broadcasts', () => {
    const store = new PanelStore();
    store.apply(sync());
    expect(store.state.offerPool).toHaveLength(1);
    expect(store.state.offerProgram).toBeNull();

    store.apply(createMessage('offer.pool.changed', { pool: [] }));
    expect(store.state.offerPool).toHaveLength(0);

    const program = { startedAt: 0, endsAt: 10_800_000, fireAt: [600_000, 4_000_000], totalCount: 3 };
    store.apply(createMessage('offer.program.changed', { program, cause: 'started' }));
    expect(store.state.offerProgram?.fireAt).toHaveLength(2);

    store.apply(createMessage('offer.program.changed', { program: null, cause: 'finished' }));
    expect(store.state.offerProgram).toBeNull();
  });

  it('tracks the active spin through its lifecycle', () => {
    const store = new PanelStore();
    store.apply(sync());

    store.apply(
      createMessage('wheel.spin.start', {
        spin: {
          spinId: 's1',
          entryId: 'e1',
          buyerName: 'Carlos',
          prizeId: 'a',
          targetSegmentIndex: 0,
          animation: { durationMs: 8000, extraRotations: 5 },
          status: 'spinning',
          startedAt: 100,
        },
      }),
    );
    expect(store.state.activeSpin?.spinId).toBe('s1');

    store.apply(
      createMessage('spin.completed', {
        spinId: 's1',
        buyerName: 'Carlos',
        prizeId: 'a',
        prizeName: 'A',
        completedAt: 200,
      }),
    );
    expect(store.state.activeSpin).toBeNull();
    expect(store.state.lastResult?.prizeName).toBe('A');
  });

  it('notifies subscribers on every applied broadcast', () => {
    const store = new PanelStore();
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.apply(sync());
    store.apply(createMessage('queue.changed', { queue: [] }));
    expect(calls).toBe(2);
    expect(store.state.queue).toHaveLength(0);
  });
});

describe('winProbability', () => {
  const prizes = SYNC_PAYLOAD.prizes;

  it('computes the live percentage among eligible prizes', () => {
    const a = prizes[0];
    const b = prizes[1];
    if (!a || !b) {
      throw new Error('fixture broken');
    }
    expect(winProbability(a, prizes)).toBeCloseTo(25);
    expect(winProbability(b, prizes)).toBeCloseTo(75);
  });

  it('returns null for prizes that cannot win', () => {
    const depleted = { ...prizes[0], id: 'c', stock: 0 } as (typeof prizes)[number];
    expect(winProbability(depleted, [...prizes, depleted])).toBeNull();
  });
});
