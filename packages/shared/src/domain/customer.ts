import { z } from 'zod';

/**
 * A persistent customer record, keyed by normalized name so "José Pérez"
 * and "jose perez " are the same person across lives. Enables the
 * once-per-customer and new-customers-only eligibility rules.
 */
export const CustomerSchema = z.object({
  id: z.string().min(1),
  /** Display name as first registered. */
  name: z.string().min(1).max(50),
  normalizedName: z.string().min(1),
  phone: z.string().min(1).max(20).optional(),
  firstSeenAt: z.number().int().nonnegative(),
});

export type Customer = z.infer<typeof CustomerSchema>;

/** trim + lowercase + collapse whitespace + strip accents (NFD). */
export function normalizeCustomerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}
