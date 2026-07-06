// Dev tool: acts as a minimal panel to trigger one spin while the real
// panel package does not exist yet.
//
//   node scripts/demo-spin.mjs [buyerName]
//
// Requires the backend running (pnpm dev) with the default dev token.
import WebSocket from 'ws';

const buyerName = process.argv[2] ?? 'Carlos';
const ws = new WebSocket('ws://127.0.0.1:8710/ws');
const send = (type, payload, requestId) => {
  ws.send(JSON.stringify({ v: 1, type, ts: Date.now(), requestId, payload }));
};

ws.on('open', () => {
  send('hello', { role: 'panel', token: process.env.WHEELLIVE_PANEL_TOKEN ?? 'dev-token' });
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  switch (message.type) {
    case 'state.sync':
      send('queue.add', { buyerName, spins: 1 }, 'demo-add');
      break;
    case 'queue.changed': {
      const entry = message.payload.queue.find((item) => item.buyerName === buyerName);
      if (entry) {
        send('spin.launch', { entryId: entry.id }, 'demo-spin');
      }
      break;
    }
    case 'wheel.spin.start':
      console.log(
        `🎰 girando para ${message.payload.spin.buyerName} → segmento ${String(message.payload.spin.targetSegmentIndex)}`,
      );
      break;
    case 'spin.completed':
      console.log(`🎉 premio: ${message.payload.prizeName}`);
      ws.close();
      process.exit(0);
      break;
    case 'error':
      console.error(`error [${message.payload.code}]: ${message.payload.message}`);
      break;
    default:
      break;
  }
});
