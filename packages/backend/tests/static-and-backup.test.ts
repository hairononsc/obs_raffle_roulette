import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AppConfig } from '../src/config.js';
import { createApp, type WheelLiveApp } from '../src/container.js';
import { backupDatabase } from '../src/infrastructure/db/backup.js';

describe('static serving', () => {
  let app: WheelLiveApp;
  let base: string;

  beforeAll(async () => {
    const widgetDist = mkdtempSync(join(tmpdir(), 'wl-widget-'));
    const panelDist = mkdtempSync(join(tmpdir(), 'wl-panel-'));
    writeFileSync(join(widgetDist, 'index.html'), '<h1>WIDGET OK</h1>');
    writeFileSync(join(panelDist, 'index.html'), '<h1>PANEL OK</h1>');

    const config: AppConfig = {
      host: '127.0.0.1',
      port: 0,
      dbPath: ':memory:',
      timing: { landingGraceMs: 1000, celebrationMs: 50 },
      static: { widgetDist, panelDist },
    };
    app = await createApp(config);
    base = await app.start();
  });

  afterAll(async () => {
    await app.stop();
  });

  it('serves the widget build at /widget/', async () => {
    const response = await fetch(`${base}/widget/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('WIDGET OK');
  });

  it('serves the panel build at /panel/', async () => {
    const response = await fetch(`${base}/panel/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('PANEL OK');
  });

  it('redirects / to the panel', async () => {
    const response = await fetch(`${base}/`);
    expect(response.url.endsWith('/panel/')).toBe(true);
    expect(await response.text()).toContain('PANEL OK');
  });

  it('keeps the API working alongside static mounts', async () => {
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
  });
});

describe('backupDatabase', () => {
  it('copies the file into backups/ and prunes old copies', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wl-db-'));
    const dbPath = join(dir, 'wheellive.sqlite');
    writeFileSync(dbPath, 'fake-db');

    const first = backupDatabase(dbPath, 2);
    expect(first).not.toBeNull();
    expect(existsSync(first ?? '')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 5));
    backupDatabase(dbPath, 2);
    await new Promise((resolve) => setTimeout(resolve, 5));
    backupDatabase(dbPath, 2);

    const backups = readdirSync(join(dir, 'backups'));
    expect(backups).toHaveLength(2);
  });

  it('does nothing for :memory: or missing files', () => {
    expect(backupDatabase(':memory:')).toBeNull();
    const dir = mkdtempSync(join(tmpdir(), 'wl-db-'));
    mkdirSync(join(dir, 'sub'));
    expect(backupDatabase(join(dir, 'sub', 'nope.sqlite'))).toBeNull();
  });
});
