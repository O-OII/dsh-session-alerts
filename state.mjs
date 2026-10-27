/** Pure per-session attention state. Only an exact read revision acknowledges a result.
 * No OS/window focus, history replay, timers or client APIs belong in this reducer.
 * Each new attention item advances a process-wide serial, even within one session.
 * Disabling clears pending state; enabling never replays already-observed events.
 * Treat returned Maps/Sets as read-only: reduce never mutates its input.
 */
const ENDINGS = new Set(['completed', 'error', 'blocked', 'max-tokens']);
const HISTORICAL = new Set(['interrupted', 'forked']);
const INTERACTIONS = new Set(['approval', 'question']);
const KEEP = Symbol('keep pending');

export function createState({ enabled = true } = {}) {
  return { enabled: Boolean(enabled), revision: 0, sessions: new Map(), pending: new Map(), disposed: new Set() };
}
export function count(state) { return state.enabled ? Math.min(999, state.pending.size) : 0; }
function identifier(value) {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}
function freshSession(turn = null) {
  return { turn, started: false, ended: false, interactions: new Map(), seenInteractions: new Set() };
}
const turnOf = (action) => action.turn ?? null;
function terminalOnly(pending) {
  if (pending?.kind !== 'terminal') return null;
  if (!pending.waiting) return KEEP;
  const { waiting, ...terminal } = pending;
  return terminal;
}
function wrongTurn(session, action) {
  const turn = turnOf(action);
  return session.turn !== null && turn !== null && session.turn !== turn;
}
function commit(state, id, session, nextPending = KEEP) {
  const oldSession = state.sessions.get(id), oldPending = state.pending.get(id);
  let pending = nextPending === KEEP ? oldPending : nextPending;
  if (oldSession === session && oldPending === pending) return state;
  const sessions = oldSession === session ? state.sessions : new Map(state.sessions);
  if (oldSession !== session) sessions.set(id, session);
  let pendingMap = state.pending, revision = state.revision;
  if (oldPending !== pending) {
    pendingMap = new Map(state.pending);
    if (pending === undefined || pending === null) pendingMap.delete(id);
    else {
      revision++;
      pending = { ...pending, revision };
      pendingMap.set(id, pending);
    }
  }
  return { ...state, revision, sessions, pending: pendingMap };
}

export function reduce(state, action) {
  if (!action || typeof action !== 'object') return state;
  if (action.type === 'enabled') {
    if (typeof action.enabled !== 'boolean' || state.enabled === action.enabled) return state;
    return { ...state, enabled: action.enabled, pending: action.enabled ? state.pending : new Map() };
  }
  if (action.isSubagent === true || (action.delegationDepth !== undefined && action.delegationDepth !== 0)) return state;
  const id = identifier(action.sessionId);
  if (id === null) return state;
  if (action.type === 'read') {
    const pending = state.pending.get(id);
    if (!pending || !Number.isSafeInteger(action.revision) || action.revision !== pending.revision) return state;
    // Reading a result never resolves a still-active question/approval.
    return commit(state, id, state.sessions.get(id), pending.kind === 'terminal' ? pending.waiting ?? null : null);
  }
  if (action.type === 'session/dispose') {
    if (state.disposed.has(id)) return state;
    const disposed = new Set(state.disposed); disposed.add(id);
    const previous = state.sessions.get(id);
    const session = previous?.interactions.size ? { ...previous, interactions: new Map() } : previous;
    // Store detach is not a read or durable deletion. Keep unread terminal and
    // turn-dedup metadata through object unload, but retire transient waits.
    return commit({ ...state, disposed }, id, session, terminalOnly(state.pending.get(id)));
  }
  if (action.type === 'turn/start') {
    const turn = turnOf(action), previous = state.sessions.get(id);
    if (previous) {
      if (turn !== null && previous.turn === turn) return state;
      if (typeof turn === 'number' && typeof previous.turn === 'number' && turn < previous.turn) return state;
      if (turn === null && previous.started && !previous.ended) return state;
    }
    let base = state;
    if (state.disposed.has(id)) {
      const disposed = new Set(state.disposed); disposed.delete(id); base = { ...state, disposed };
    }
    // A remote/new automatic turn is NOT evidence that the old result was viewed.
    return commit(base, id, { ...freshSession(turn), started: true }, terminalOnly(state.pending.get(id)));
  }
  if (state.disposed.has(id)) return state;
  let previous = state.sessions.get(id) ?? freshSession(turnOf(action));
  if (wrongTurn(previous, action)) return state;
  if (previous.turn === null && turnOf(action) !== null) previous = { ...previous, turn: turnOf(action) };
  if (action.type === 'turn/end') {
    const reason = typeof action.reason === 'string' ? action.reason : action.reason?.kind;
    if (HISTORICAL.has(reason) || (!ENDINGS.has(reason) && reason !== 'aborted') || previous.ended) return state;
    const session = { ...previous, ended: true, interactions: new Map() };
    const pending = ENDINGS.has(reason) && state.enabled
      ? { kind: 'terminal', reason, turn: session.turn, eventSeq: action.eventSeq ?? null }
      : terminalOnly(state.pending.get(id));
    return commit(state, id, session, pending);
  }
  if (action.type === 'waiting/start' || action.type === 'waiting/resolved') {
    const interactionId = identifier(action.interactionId);
    if (interactionId === null || !INTERACTIONS.has(action.interaction) || previous.ended) return state;
    const key = JSON.stringify([action.interaction, interactionId]);
    const seen = previous.seenInteractions.has(key), active = previous.interactions.has(key);
    if (action.type === 'waiting/start' && seen || action.type === 'waiting/resolved' && seen && !active) return state;
    const seenInteractions = new Set(previous.seenInteractions), interactions = new Map(previous.interactions);
    seenInteractions.add(key);
    if (action.type === 'waiting/start') {
      interactions.set(key, { interaction: action.interaction, interactionId });
      const waiting = { kind: 'waiting', turn: previous.turn, interactions: [...interactions.values()] };
      const terminal = state.pending.get(id);
      const pending = !state.enabled ? KEEP : terminal?.kind === 'terminal' ? { ...terminal, waiting } : waiting;
      return commit(state, id, { ...previous, interactions, seenInteractions }, pending);
    }
    interactions.delete(key);
    const oldPending = state.pending.get(id);
    const waiting = { kind: 'waiting', turn: previous.turn, interactions: [...interactions.values()] };
    const pending = oldPending?.kind === 'terminal'
      ? oldPending.waiting ? interactions.size ? { ...oldPending, waiting } : terminalOnly(oldPending) : KEEP
      : oldPending?.kind === 'waiting' ? interactions.size ? waiting : null : KEEP;
    return commit(state, id, { ...previous, interactions, seenInteractions }, pending);
  }
  return state;
}
