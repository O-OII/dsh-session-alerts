// Local SDK extension, MIT. Inserted in the official module factory.
// Public SnapshotSource subscriptions only; no private React/store access.
const INACTIVE_SESSION_FILTERS = Object.freeze({ active: false, matches: () => true, pendingCount: 0, unknownCount: 0 });

function copySessionFilterSnapshot(snapshot) {
  if (!snapshot || typeof snapshot.enabled !== "boolean" || !snapshot.matchingSessionIds ||
      typeof snapshot.matchingSessionIds[Symbol.iterator] !== "function") {
    throw new TypeError("sessionFilters: expected enabled and matchingSessionIds");
  }
  const copyIds = (ids) => {
    const result = new Set(ids ?? []);
    for (const id of result) if (typeof id !== "string") throw new TypeError("sessionFilters: session ids must be strings");
    return result;
  };
  return { enabled: snapshot.enabled, matching: copyIds(snapshot.matchingSessionIds), pending: copyIds(snapshot.pendingSessionIds), unknown: copyIds(snapshot.unknownSessionIds) };
}

/** Public lifetime-owned registry. Each contribution must be disposed by its owner. */
class SessionFiltersRegistry {
  get apiVersion() { return 1; }
  #entries = new Map();
  #enabled = [];
  #listeners = new Set();
  #snapshot = INACTIVE_SESSION_FILTERS;
  #disposed = false;
  getSnapshot = () => this.#snapshot;
  subscribe = (listener) => {
    if (this.#disposed) return () => {};
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };
  register({ id, source }) {
    if (this.#disposed) throw new Error("sessionFilters: registry disposed");
    if (typeof id !== "string" || !id.trim()) throw new TypeError("sessionFilters: non-empty id required");
    if (this.#entries.has(id)) throw new Error(`sessionFilters: duplicate id ${id}`);
    if (!source || typeof source.getSnapshot !== "function" || typeof source.subscribe !== "function") throw new TypeError("sessionFilters: SnapshotSource required");
    const initial = source.getSnapshot();
    const entry = { sourceSnapshot: initial, value: copySessionFilterSnapshot(initial), stop: () => {} };
    this.#entries.set(id, entry);
    const refresh = () => {
      if (this.#entries.get(id) !== entry) return;
      const next = source.getSnapshot();
      if (Object.is(next, entry.sourceSnapshot)) return;
      const value = copySessionFilterSnapshot(next);
      entry.sourceSnapshot = next;
      entry.value = value;
      this.#rebuild();
    };
    try {
      const stop = source.subscribe(refresh);
      if (typeof stop !== "function") throw new TypeError("sessionFilters: subscribe must return disposer");
      entry.stop = stop;
      refresh(); // Close getSnapshot/subscribe race, including synchronous subscriptions.
      this.#rebuild();
    } catch (error) {
      this.#entries.delete(id);
      entry.stop();
      this.#rebuild();
      throw error;
    }
    let live = true;
    return () => {
      if (!live) return;
      live = false;
      if (this.#entries.get(id) !== entry) return;
      this.#entries.delete(id);
      try { entry.stop(); } finally { this.#rebuild(); }
    };
  }
  #rebuild() {
    const enabled = [...this.#entries.values()].map((entry) => entry.value).filter((value) => value.enabled);
    if (enabled.length === this.#enabled.length && enabled.every((value, index) => value === this.#enabled[index])) return;
    this.#enabled = enabled;
    let next = INACTIVE_SESSION_FILTERS;
    if (enabled.length) {
      // Private copies prevent mutation of any published snapshot through a caller's Set.
      const pending = new Set(enabled.flatMap((value) => [...value.pending]));
      const unknown = new Set(enabled.flatMap((value) => [...value.unknown]));
      next = Object.freeze({
        active: true,
        matches: (id) => enabled.every((value) => value.matching.has(id) && !value.pending.has(id) && !value.unknown.has(id)),
        pendingCount: pending.size,
        unknownCount: unknown.size,
      });
    }
    if (next === this.#snapshot) return;
    this.#snapshot = next;
    for (const listener of [...this.#listeners]) listener();
  }
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    const entries = [...this.#entries.values()];
    this.#entries.clear();
    try {
      for (const entry of entries) {
        try { entry.stop(); } catch (error) { console.warn("sessionFilters unsubscribe failed", error); }
      }
      this.#rebuild();
    } finally { this.#listeners.clear(); }
  }
}

/** Preserve input identity in the no-filter path. */
function filterSessions(sessions, filters = INACTIVE_SESSION_FILTERS) {
  return filters.active ? sessions.filter((session) => filters.matches(session.id)) : sessions;
}
