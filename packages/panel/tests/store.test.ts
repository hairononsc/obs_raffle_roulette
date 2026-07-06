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
