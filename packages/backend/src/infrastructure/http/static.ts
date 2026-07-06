import { existsSync } from 'node:fs';
import { join } from 'node:path';

import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

import type { StaticConfig } from '../../config.js';

/**
 * Serves the built widget and panel from the backend so production runs as
 * a single process on a single port: OBS points at /widget/, the operator
 * at /panel/. Missing builds are skipped with a hint instead of failing —
 * dev mode keeps using the Vite servers.
 */
export async function registerStaticRoutes(
  app: FastifyInstance,
  config: StaticConfig,
): Promise<void> {
  const mounts = [
    { root: config.widgetDist, prefix: '/widget/', name: 'widget' },
    { root: config.panelDist, prefix: '/panel/', name: 'panel' },
  ];

  let panelMounted = false;
  for (const mount of mounts) {
    if (mount.root === null) {
      continue;
    }
    if (!existsSync(join(mount.root, 'index.html'))) {
      console.warn(
        `[wheellive] ${mount.name} build not found at ${mount.root} — run "pnpm build" to serve it from the backend`,
      );
      continue;
    }
    await app.register(fastifyStatic, {
      root: mount.root,
      prefix: mount.prefix,
      decorateReply: false,
      redirect: true,
    });
    console.log(`[wheellive] serving ${mount.name} at ${mount.prefix}`);
    if (mount.name === 'panel') {
      panelMounted = true;
    }
  }

  if (panelMounted) {
    app.get('/', (_request, reply) => reply.redirect('/panel/'));
  }
}
