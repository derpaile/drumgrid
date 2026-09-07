/** Subscribers update only the small live views, never the workstation itself. */
export function createLiveStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    server: () => initial,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set: (next: T) => { if (Object.is(next, value)) return; value = next; listeners.forEach(listener => listener()); },
  };
}
export type LiveStore<T> = ReturnType<typeof createLiveStore<T>>;
export type PlaybackDisplay = { step: number; bars: number; timer: string };
