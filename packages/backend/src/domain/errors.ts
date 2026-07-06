import type { ErrorCode } from '@wheellive/shared';

/**
 * Business-rule violation. The WebSocket layer maps these 1:1 to protocol
 * `error` messages; anything else that escapes is an INTERNAL_ERROR.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
