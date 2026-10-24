/**
 * Pure, immutable state for live taskbar-badge events. No log replay, timers,
 * DSH imports or platform APIs belong here. Each pending main session counts
 * once, irrespective of its number of pending interactions.
 *
 * Actions:
 *   { type: 'focus', focused: boolean }
 *   { type: 'enabled', enabled: boolean }
 *   { type: 'turn/start', sessionId, turn?, delegationDepth? }
 *   { type: 'turn/end', sessionId, turn?, reason, delegationDepth? }
 *   { type: 'waiting/start' | 'waiting/resolved', sessionId, turn?,
 *     interaction: 'approval' | 'question', interactionId, delegationDepth? }
 *   { type: 'session/dispose', sessionId, delegationDepth? }
 *
 * `reason` accepts a reason object with `kind`, or the kind string. Only live
 * completed/error/blocked/max-tokens endings notify. Aborts clear waiting but
 * do not notify; interrupted/forked history markers are entirely ignored.
 *
 * Forward `turn` when available. interactionId must identify the actual request
 * or tool execution, not just a model-authored question id that may be reused.
 * A matching turn lets us reject resolutions from an earlier turn even when
 * an interaction id is reused. Numeric turn/start events also reject older
 * turn numbers. With no turn, a start during an open turn is a duplicate.
 *
 * Focus/disable clears pending items but retains deduplication metadata:
 * blurring/re-enabling must never replay already-observed events. A dispose
 * removes session state and suppresses late events until a new turn/start.
 * Treat returned Maps/Sets as read-only. reduce never mutates an input state.
 */

const ENDINGS = new Set(['completed', 'error', 'blocked', 'max-tokens']);
const HISTORICAL = new Set(['interrupted', 'forked']);
const INTERACTIONS = new Set(['approval', 'question']);
const KEEP = Symbol('keep pending');

export function createState({ enabled = true, focused = false } = {}) {
  return {
    enabled: Boolean(enabled),
    focused: Boolean(focused),
    sessions: new Map(),
    pending: new Map(),
    disposed: new Set(),
  };
}

/** Logical count is capped at 999; format e.g. 99+ in the presentation layer. */
export function count(state) {
  return state.enabled && !state.focused ? Math.min(999, state.pending.size) : 0;
}

function identifier(value) {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function freshSession(turn = null) {
  return {
    turn,
    started: false,
    ended: false,
    interactions: new Map(),
    seenInteractions: new Set(),
  };
}

function turnOf(action) {
  return action.turn === undefined || action.turn === null ? null : action.turn;
}

function wrongTurn(session, action) {
  const turn = turnOf(action);
  return session.turn !== null && turn !== null && session.turn !== turn;
}

function commit(state, id, session, nextPending = KEEP) {
  const oldSession = state.sessions.get(id);
  const oldPending = state.pending.get(id);
  const pending = nextPending === KEEP ? oldPending : nextPending;
  if (oldSession === session && oldPending === pending) return state;
  const sessions = oldSession === session ? state.sessions : new Map(state.sessions);
  if (oldSession !== session) sessions.set(id, session);
  let pendingMap = state.pending;
  if (oldPending !== pending) {
    pendingMap = new Map(state.pending);
    if (pending === undefined || pending === null) pendingMap.delete(id);
    else pendingMap.set(id, pending);
  }
  return { ...state, sessions, pending: pendingMap };
}

export function reduce(state, action) {
  if (!action || typeof action !== 'object') return state;

  if (action.type === 'focus' || action.type === 'enabled') {
    const field = action.type === 'focus' ? 'focused' : 'enabled';
    if (typeof action[field] !== 'boolean') return state;
    const value = action[field];
    const clear = field === 'focused' ? value : !value;
    if (state[field] === value && (!clear || state.pending.size === 0)) return state;
    return {
      ...state,
      [field]: value,
      pending: clear ? new Map() : state.pending,
    };
  }

  if (action.isSubagent === true ||
      (action.delegationDepth !== undefined && action.delegationDepth !== 0)) return state;
  const id = identifier(action.sessionId);
  if (id === null) return state;

  if (action.type === 'session/dispose') {
    if (state.disposed.has(id) && !state.sessions.has(id) && !state.pending.has(id)) return state;
    const sessions = new Map(state.sessions);
    const pending = new Map(state.pending);
    const disposed = new Set(state.disposed);
    sessions.delete(id);
    pending.delete(id);
    disposed.add(id);
    return { ...state, sessions, pending, disposed };
  }

  if (action.type === 'turn/start') {
    const turn = turnOf(action);
    const previous = state.sessions.get(id);
    if (previous && !state.disposed.has(id)) {
      if (turn !== null && previous.turn === turn) return state;
      if (typeof turn === 'number' && typeof previous.turn === 'number' && turn < previous.turn) return state;
      if (turn === null && previous.started && !previous.ended) return state;
    }
    let base = state;
    if (state.disposed.has(id)) {
      const disposed = new Set(state.disposed);
      disposed.delete(id);
      base = { ...state, disposed };
    }
    return commit(base, id, { ...freshSession(turn), started: true }, null);
  }

  if (state.disposed.has(id)) return state;
  let previous = state.sessions.get(id) ?? freshSession(turnOf(action));
  if (wrongTurn(previous, action)) return state;
  // A live subscription can begin mid-turn. Adopt the first available turn
  // identity so later stale ends/resolutions can still be rejected.
  if (previous.turn === null && turnOf(action) !== null) {
    previous = { ...previous, turn: turnOf(action) };
  }

  if (action.type === 'turn/end') {
    const reason = typeof action.reason === 'string' ? action.reason : action.reason?.kind;
    if (HISTORICAL.has(reason) || (!ENDINGS.has(reason) && reason !== 'aborted')) return state;
    if (previous.ended) return state;
    const session = { ...previous, ended: true, interactions: new Map() };
    const pending = ENDINGS.has(reason) && state.enabled && !state.focused
      ? { kind: 'terminal', reason, turn: session.turn }
      : null;
    return commit(state, id, session, pending);
  }

  if (action.type === 'waiting/start' || action.type === 'waiting/resolved') {
    const interactionId = identifier(action.interactionId);
    if (interactionId === null || !INTERACTIONS.has(action.interaction) || previous.ended) return state;
    // JSON encoding keeps arbitrary ids containing delimiters collision-free.
    const key = JSON.stringify([action.interaction, interactionId]);
    const seen = previous.seenInteractions.has(key);
    const active = previous.interactions.has(key);
    if (action.type === 'waiting/start' && seen) return state;
    if (action.type === 'waiting/resolved' && seen && !active) return state;
    const seenInteractions = new Set(previous.seenInteractions);
    const interactions = new Map(previous.interactions);
    seenInteractions.add(key);
    if (action.type === 'waiting/start') {
      interactions.set(key, { interaction: action.interaction, interactionId });
      const pending = state.enabled && !state.focused
        ? { kind: 'waiting', turn: previous.turn }
        : KEEP;
      return commit(state, id, { ...previous, interactions, seenInteractions }, pending);
    }
    interactions.delete(key);
    const pending = interactions.size === 0 && state.pending.get(id)?.kind === 'waiting' ? null : KEEP;
    return commit(state, id, { ...previous, interactions, seenInteractions }, pending);
  }

  return state;
}
