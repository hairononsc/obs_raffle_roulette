import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { HistoryService } from '../../application/services/history-service.js';

const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function registerHttpRoutes(app: FastifyInstance, history: HistoryService): void {
  app.get('/health', () => ({ status: 'ok' }));

  app.get('/api/history', async (request, reply) => {
    const query = HistoryQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: 'invalid query parameters' });
    }
    return history.page(query.data.limit, query.data.offset);
  });

  app.get('/api/stats', () => history.stats());
}
