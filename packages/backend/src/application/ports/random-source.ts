export interface RandomSource {
  /** Returns a value in [0, 1). Injected so tests can be deterministic. */
  next(): number;
}
