import { DEFAULT_PANEL_TOKEN, loadConfig } from './config.js';
import { createApp } from './container.js';

const config = loadConfig();
const app = await createApp(config);
const address = await app.start();

console.log(`[wheellive] backend listening at ${address}`);
console.log(`[wheellive] websocket endpoint: ${address.replace(/^http/, 'ws')}/ws`);
if (config.panelToken === DEFAULT_PANEL_TOKEN) {
  console.warn(
    '[wheellive] WARNING: using the default panel token; set WHEELLIVE_PANEL_TOKEN for real streams',
  );
}

const shutdown = (signal: string): void => {
  console.log(`[wheellive] ${signal} received, shutting down`);
  app
    .stop()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error('[wheellive] shutdown failed', error);
      process.exit(1);
    });
};

process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
