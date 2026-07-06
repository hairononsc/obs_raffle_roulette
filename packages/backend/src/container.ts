import Fastify, { type FastifyInstance } from 'fastify';

import type { AppConfig } from './config.js';
import { HistoryService } from './application/services/history-service.js';
import { PrizeService } from './application/services/prize-service.js';
import { QueueService } from './application/services/queue-service.js';
import { SettingsService } from './application/services/settings-service.js';
import { SnapshotService } from './application/services/snapshot-service.js';
import { SpinService } from './application/services/spin-service.js';
import { backupDatabase } from './infrastructure/db/backup.js';
import { createDatabase } from './infrastructure/db/database.js';
import { seedIfEmpty } from './infrastructure/db/seed.js';
import { KyselyUnitOfWork } from './infrastructure/db/unit-of-work.js';
import { registerHttpRoutes } from './infrastructure/http/routes.js';
import { registerStaticRoutes } from './infrastructure/http/static.js';
import { cryptoIdGenerator } from './infrastructure/runtime/crypto-id-generator.js';
import { mathRandomSource } from './infrastructure/runtime/math-random-source.js';
import { nodeScheduler } from './infrastructure/runtime/node-scheduler.js';
import { SimpleEventBus } from './infrastructure/runtime/simple-event-bus.js';
import { systemClock } from './infrastructure/runtime/system-clock.js';
import { connectBroadcaster } from './infrastructure/ws/broadcaster.js';
import { ClientSession } from './infrastructure/ws/client-session.js';
import { CommandDispatcher } from './infrastructure/ws/command-dispatcher.js';
import { ConnectionRegistry } from './infrastructure/ws/connection-registry.js';
import { attachWebSocketServer } from './infrastructure/ws/ws-server.js';

export interface AppServices {
  queue: QueueService;
  prizes: PrizeService;
  settings: SettingsService;
  spins: SpinService;
  history: HistoryService;
  snapshot: SnapshotService;
}

export interface WheelLiveApp {
  config: AppConfig;
  fastify: FastifyInstance;
  services: AppServices;
  /** Starts listening; returns the base HTTP address. */
  start(): Promise<string>;
  stop(): Promise<void>;
}

/**
 * Composition root: the only place that knows concrete adapters. Everything
 * else depends on ports, which is what keeps SQLite, ws and fastify
 * replaceable without touching domain or application code.
 */
export async function createApp(config: AppConfig): Promise<WheelLiveApp> {
  const backupPath = backupDatabase(config.dbPath);
  if (backupPath !== null) {
    console.log(`[wheellive] database backed up to ${backupPath}`);
  }

  const db = createDatabase(config.dbPath);
  const uow = new KyselyUnitOfWork(db);
  const events = new SimpleEventBus();

  const spins = new SpinService({
    uow,
    events,
    ids: cryptoIdGenerator,
    clock: systemClock,
    rng: mathRandomSource,
    scheduler: nodeScheduler,
    timing: config.timing,
  });
  const queue = new QueueService(uow, events, cryptoIdGenerator, systemClock);
  const prizes = new PrizeService(uow, events, cryptoIdGenerator, systemClock, spins);
  const settings = new SettingsService(uow, events);
  const history = new HistoryService(uow);
  const snapshot = new SnapshotService(uow, spins);

  await seedIfEmpty(uow, cryptoIdGenerator, systemClock);
  await spins.recoverOnBoot();

  const fastify = Fastify({ logger: false });
  registerHttpRoutes(fastify, history);
  await registerStaticRoutes(fastify, config.static);
  await fastify.ready();

  const registry = new ConnectionRegistry();
  connectBroadcaster(events, registry);
  const dispatcher = new CommandDispatcher({ queue, prizes, settings, spins });

  attachWebSocketServer({
    httpServer: fastify.server,
    path: '/ws',
    onConnection: (socket) => {
      new ClientSession(socket, {
        registry,
        dispatcher,
        snapshot,
        panelToken: config.panelToken,
      }).start();
    },
  });

  return {
    config,
    fastify,
    services: { queue, prizes, settings, spins, history, snapshot },
    start: () => fastify.listen({ host: config.host, port: config.port }),
    stop: async () => {
      await fastify.close();
      await db.destroy();
    },
  };
}
