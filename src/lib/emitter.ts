export class Emitter<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<(payload: never) => void>>();

  on<K extends keyof Events>(event: K, fn: (payload: Events[K]) => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn as (payload: never) => void);
    return () => this.handlers.get(event)?.delete(fn as (payload: never) => void);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    this.handlers.get(event)?.forEach((fn) => (fn as (p: Events[K]) => void)(payload));
  }
}
