import type { PrizeInput } from '@wheellive/shared';

import type { Clock } from '../../application/ports/clock.js';
import type { IdGenerator } from '../../application/ports/id-generator.js';
import type { UnitOfWork } from '../../application/ports/repositories.js';

/**
 * First-boot seed: the official Hannah Pacas Premium prize lineup, with
 * weights that sum to 100 (weight = win %) and eligibility conditions
 * pre-configured. A fresh database boots live-ready; the operator can
 * still edit everything from the panel.
 *
 * "Máximo N por Live" maps to maxPerDay (one live per calendar day).
 */
const SEED_PRIZES: readonly PrizeInput[] = [
  {
    name: 'Jean GRATIS',
    weight: 0.5,
    stock: null,
    color: '#FFD700',
    icon: '👖',
    active: true,
    cost: 355.7,
    // Compra mínima RD$750 · máximo 1 ganador por live. "Sujeto a
    // disponibilidad" = pon stock real desde el panel si quieres tope duro.
    conditions: { minPurchase: 750, maxPerDay: 1 },
  },
  {
    name: 'Reembolso Parcial',
    weight: 1,
    stock: null,
    color: '#00C853',
    icon: '💸',
    active: true,
    cost: 300, // hasta RD$300, monto configurable al entregar
    conditions: { minPurchase: 700, maxPerDay: 2 },
  },
  {
    name: 'Regalo Sorpresa',
    weight: 12,
    stock: null,
    color: '#9C27B0',
    icon: '🎁',
    active: true,
    cost: 40, // costo máximo del detalle físico (RD$20–40)
    conditions: {},
  },
  {
    name: 'Vuelve a Girar',
    weight: 18,
    stock: null,
    color: '#2196F3',
    icon: '🔄',
    active: true,
    cost: 0,
    conditions: {},
  },
  {
    name: 'Cliente VIP',
    weight: 10,
    stock: null,
    color: '#FF9800',
    icon: '⭐',
    active: true,
    cost: 0, // acceso a promociones exclusivas y prioridad en próximos eventos
    conditions: {},
  },
  {
    name: 'Cupón Próxima Compra',
    weight: 10,
    stock: null,
    color: '#CDDC39',
    icon: '🎟️',
    active: true,
    cost: 0, // RD$0 inmediato; monto configurable (RD$100, RD$150, %) al redimir
    conditions: {},
  },
  {
    name: 'Accesorio Sorpresa',
    weight: 10,
    stock: null,
    color: '#EC407A',
    icon: '🌸',
    active: true,
    cost: 40, // RD$20–40
    conditions: {},
  },
  {
    name: 'Oferta Exclusiva',
    weight: 8,
    stock: null,
    color: '#F44336',
    icon: '⚡',
    active: true,
    cost: 0, // variable; la define el operador en la campaña
    // Solo aparece cuando hay una oferta relámpago / campaña activa.
    conditions: { requiresActiveOffer: true },
  },
  {
    name: 'Doble Participación',
    weight: 8,
    stock: null,
    color: '#00BCD4',
    icon: '🎀',
    active: true,
    cost: 0, // válida para el próximo evento de ruleta, no el live actual
    conditions: {},
  },
  {
    name: 'Gracias por apoyar',
    weight: 22.5,
    stock: null,
    color: '#9E9E9E',
    icon: '🤍',
    active: true,
    cost: 0, // premio neutro: equilibra la probabilidad total al 100%
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
