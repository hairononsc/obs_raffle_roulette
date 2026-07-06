import { DomainError } from './errors.js';

/**
 * Server-side spin states. The protocol's transient `landed` is not stored:
 * receiving `wheel.spin.landed` moves the spin straight to `celebrating`.
 *
 *   spinning ──(widget lands)──▶ celebrating ──(timer)──▶ completed
 *      └───────(safety timeout: widget offline)──────────▶ completed
 */
export type SpinStatus = 'spinning' | 'celebrating' | 'completed';

const ALLOWED_TRANSITIONS: Record<SpinStatus, readonly SpinStatus[]> = {
  spinning: ['celebrating', 'completed'],
  celebrating: ['completed'],
  completed: [],
};

export function canTransition(from: SpinStatus, to: SpinStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: SpinStatus, to: SpinStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError('INVALID_STATE', `illegal spin transition ${from} -> ${to}`);
  }
}
