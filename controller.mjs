/** DSH event adapter: pure badge state + live committed events, never history scans. */
import { createState, reduce, count } from './state.mjs';
import { randomUUID } from 'node:crypto';

export function createController({ onCount = () => {}, onChange = () => {}, enabled = true,
  notifyOnError = true, notifyOnWaiting = true, notifyOnGoalRounds = false } = {}) {
  let state = createState({ enabled });
  const epoch = randomUUID(); // Never accept receipts from a previous mount/Host.
  let serial = 0;
  let observed = 0;
  const executions = new WeakMap();
  const snapshot = () => ({
    enabled: state.enabled, pendingCount: count(state),
    trackedSessions: state.sessions.size, pendingSessions: state.pending.size, observedActions: observed,
  });
  function dispatch(action) {
    const before = count(state);
    const next = reduce(state, action);
    observed++;
    if (next === state) return;
    state = next;
    const after = count(state);
    if (after !== before) onCount(after);
    onChange(snapshot());
  }
  function identity(session) {
    const sessionId = session?.id ?? session?.header?.id;
    const delegationDepth = session?.header?.delegationDepth ?? 0;
    if ((typeof sessionId !== 'string' && typeof sessionId !== 'number') || delegationDepth !== 0 || session?.header?.origin === 'subagent') return null;
    return { sessionId, delegationDepth };
  }
  return {
    snapshot,
    pendingFor(sessionId) {
      const item = state.pending.get(String(sessionId));
      return item ? { ...item, revision: `${epoch}:${item.revision}`, sessionId: String(sessionId) } : null;
    },
    acknowledge({ sessionId, revision, turn, eventSeq, kind } = {}) {
      const pending = state.pending.get(String(sessionId));
      if (!pending || typeof revision !== 'string' || revision !== `${epoch}:${pending.revision}` ||
          kind !== pending.kind || turn !== pending.turn || eventSeq !== pending.eventSeq) return false;
      dispatch({ type: 'read', sessionId, revision: pending.revision });
      return true;
    },
    setEnabled(value) { dispatch({ type: 'enabled', enabled: Boolean(value) }); },
    sessionEvent(session, event, projection = {}) {
      const id = identity(session);
      if (!id || !event) return;
      const common = { ...id, turn: event.data?.turn ?? projection.turn, eventSeq: event.seq };
      switch (event.type) {
        case 'turn/start':
          dispatch({ ...common, type: 'turn/start' });
          break;
        case 'turn/end': {
          const reason = event.data?.reason;
          const suppressed = (!notifyOnError && ['error', 'blocked', 'max-tokens'].includes(reason?.kind)) ||
            (!notifyOnGoalRounds && projection.goalPhase === 'active' && reason?.kind === 'completed');
          dispatch({ ...common, type: 'turn/end', reason: suppressed ? { kind: 'aborted' } : reason });
          break;
        }
        case 'approval/asked':
          if (notifyOnWaiting) dispatch({ ...common, type: 'waiting/start', interaction: 'approval', interactionId: event.data?.id });
          break;
        case 'approval/decided':
          dispatch({ ...common, type: 'waiting/resolved', interaction: 'approval', interactionId: event.data?.id });
          break;
        default:
          break;
      }
    },
    sessionDisposed(session) {
      const id = identity(session);
      if (id) dispatch({ ...id, type: 'session/dispose' });
    },
    questionStarted(exec, projection = {}) {
      if (!notifyOnWaiting || exec?.name !== 'ask_user_question') return null;
      const id = identity(exec.agent?.session);
      if (!id) return null;
      let token = executions.get(exec);
      if (!token) {
        token = { ...id, turn: projection.turn, interaction: 'question',
          interactionId: String(exec.callId ?? exec.id ?? `local-question-${++serial}`) };
        executions.set(exec, token);
      }
      dispatch({ ...token, type: 'waiting/start' });
      return token;
    },
    questionResolved(token) {
      if (token) dispatch({ ...token, type: 'waiting/resolved' });
    },
  };
}
