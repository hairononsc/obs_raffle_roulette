import { randomUUID } from 'node:crypto';

import type { IdGenerator } from '../../application/ports/id-generator.js';

export const cryptoIdGenerator: IdGenerator = {
  next: (prefix) => `${prefix}-${randomUUID()}`,
};
