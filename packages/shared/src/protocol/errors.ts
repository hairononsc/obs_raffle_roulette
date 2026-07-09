import { z } from 'zod';

/**
 * Every error the server can reply with. Kept as a closed set so the panel
 * can map codes to user-facing messages and the widget can decide what is
 * safe to ignore.
 */
export const ERROR_CODES = [
  /** Frame was not valid JSON or did not match the protocol schema. */
  'INVALID_MESSAGE',
  /** The sender's role is not allowed to send this message type. */
  'FORBIDDEN',
  /** Referenced queue entry does not exist. */
  'ENTRY_NOT_FOUND',
  /** Referenced prize does not exist. */
  'PRIZE_NOT_FOUND',
  /** A spin is already active; only one spin may run at a time. */
  'SPIN_IN_PROGRESS',
  /** `wheel.spin.landed` referenced a spin that is not the active one. */
  'SPIN_NOT_ACTIVE',
  /** No active prize with remaining stock; the spin cannot be launched. */
  'NO_STOCK_AVAILABLE',
  /** The wheel has prizes, but none is eligible for THIS entry right now
   *  (conditions, caps or snapshot). Distinct from NO_STOCK_AVAILABLE. */
  'NO_ELIGIBLE_PRIZES',
  /** Referenced wheel profile does not exist. */
  'PROFILE_NOT_FOUND',
  /** The queue entry has no spins left. */
  'NO_SPINS_REMAINING',
  /** The command is not legal in the current server state. */
  'INVALID_STATE',
  /** Unexpected server-side failure. */
  'INTERNAL_ERROR',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
