import type { DomainEvent, EventBus, EventHandler } from '../../application/ports/event-bus.js';

/**
 * Synchronous in-process fan-out. A failing subscriber is isolated and
 * logged so one bad handler cannot break spin processing.
 */
export class SimpleEventBus implements EventBus {
  private readonly handlers = new Set<EventHandler>();

  publish(event: DomainEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(`[event-bus] handler failed for "${event.kind}"`, error);
      }
    }
  }

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}
