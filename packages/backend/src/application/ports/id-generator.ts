export interface IdGenerator {
  /** Returns a new unique id, e.g. `next('spin')` -> `spin-<uuid>`. */
  next(prefix: string): string;
}
