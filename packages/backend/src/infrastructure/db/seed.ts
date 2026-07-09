import type { PrizeInput } from '@wheellive/shared';

import type { Clock } from '../../application/ports/clock.js';
import type { IdGenerator } from '../../application/ports/id-generator.js';
import type { UnitOfWork } from '../../application/ports/repositories.js';

/**
 * First-boot convenience: an empty wheel is unusable, so a fresh database
 * gets a sample prize set the operator can edit or delete from the panel.
 */
const SEED_PRIZES: readonly PrizeInput[] = [
  {
    name: 'Pantalón Premium',
    weight: 1,
    stock: 5,
    color: '#E63946',
    icon: 'prize-jeans',
    active: true,
    cost: 0,
    conditions: {},
  },
  {
    name: '10% Descuento',
    weight: 4,
    stock: null,
    color: '#457B9D',
    icon: 'prize-discount',
    active: true,
    cost: 0,
    conditions: {},
  },
  {
    name: 'Envío Gratis',
    weight: 3,
    stock: null,
    color: '#2A9D8F',
    icon: 'prize-shipping',
    active: true,
    cost: 0,
    conditions: {},
  },
  {
    name: 'Gorra Exclusiva',
    weight: 2,
    stock: 10,
    color: '#E9C46A',
    icon: 'prize-cap',
    active: true,
    cost: 0,
    conditions: {},
  },
];

export async function seedIfEmpty(
  uow: UnitOfWork,
  ids: IdGenerator,
  clock: Clock,
): Promise<boolean> {
  return uow.run(async (repos) => {
    const existing = await repos.prizes.list();
    if (existing.length > 0) {
      return false;
    }
    for (const input of SEED_PRIZES) {
      await repos.prizes.create({ id: ids.next('prize'), ...input }, clock.now());
    }
    return true;
  });
}
