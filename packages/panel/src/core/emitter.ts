type AnyHandler = (payload: never) => void;

/** Minimal typed event emitter (browser-safe, no Node dependency). */
export class Emitter<Events extends Record<string, unknown>> {
  private readonly handlers = new Map<keyof Events, Set<AnyHandler>>();

  on<K extends keyof Events>(event: K, handler: (payload: Events[K]) => void): () => void {
    const set = this.handlers.get(event) ?? new Set<AnyHandler>();
    set.add(handler);
    this.handlers.set(event, set);
    return () => {
      set.delete(handler);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }
    for (const handler of set) {
      (handler as (payload: Events[K]) => void)(payload);
    }
  }
}
