/**
 * Lets other services ask "is a spin running?" without depending on the
 * full SpinService (avoids a circular dependency with PrizeService).
 */
export interface ActiveSpinGuard {
  hasActiveSpin(): boolean;
}
