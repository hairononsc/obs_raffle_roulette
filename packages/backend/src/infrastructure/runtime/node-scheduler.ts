import type { ScheduledTask, Scheduler } from '../../application/ports/scheduler.js';

export const nodeScheduler: Scheduler = {
  schedule(delayMs: number, task: () => void): ScheduledTask {
    const handle = setTimeout(task, delayMs);
    return {
      cancel: () => {
        clearTimeout(handle);
      },
    };
  },
};
