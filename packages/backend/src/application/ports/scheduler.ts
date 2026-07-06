export interface ScheduledTask {
  cancel(): void;
}

/** Deferred execution port; the production adapter wraps setTimeout. */
export interface Scheduler {
  schedule(delayMs: number, task: () => void): ScheduledTask;
}
