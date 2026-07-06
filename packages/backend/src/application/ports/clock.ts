export interface Clock {
  /** Current time as epoch milliseconds. */
  now(): number;
}
