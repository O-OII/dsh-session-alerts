/** Read-only completion projection. Work accounting follows the SDK's
 * foldConsumedWork semantics: steps account; pre-step completed claims/no-ops
 * don't; dropped unrun input invalidates success until later accounted work.
 * Goal replay is delegated to the official strict goal projection definition.
 */
import { COMPLETION_KEY, GOAL_PHASES, parseCompletionView } from './completion-contract.mjs';
export { COMPLETION_KEY, parseCompletionView } from './completion-contract.mjs';
const PHASES = GOAL_PHASES;
const integer = value => Number.isSafeInteger(value) && value >= 0;
function phaseOf(goal) { return goal.current?.goal?.phase ?? 'none'; }
function viewOf(state) {
  let classification = 'incomplete';
  const currentGoal = state.goal.current?.goal;
  const end = state.accounting;
  if (state.goal.failure !== null) classification = 'unknown';
  else if (state.approvals.length) classification = 'waiting';
  else if (state.open !== null) classification = 'running';
  else if (state.main && end && !state.droppedUnrun) {
    if (['error','blocked','max-tokens'].includes(end.kind)) classification = 'error';
    else if (end.kind === 'completed' &&
      (end.goalId === null || end.goalPhase === 'complete') &&
      (!currentGoal || currentGoal.phase === 'complete' && currentGoal.id === end.goalId)) classification = 'completed';
  }
  return { version: 1, state: classification, main: state.main,
    turn: end?.turn ?? state.open ?? state.turn, eventSeq: end?.seq ?? null,
    goalPhaseAtEnd: end?.goalPhase ?? 'none', goalIdAtEnd: end?.goalId ?? null,
    droppedUnrun: state.droppedUnrun };
}
export function createCompletionDefinition(goalDefinition) {
  if (!goalDefinition?.init || !goalDefinition.apply || !goalDefinition.stateSchema?.parse) throw new TypeError('Official strict goal projection required');
  const stateSchema = { parse(value) {
    if (!value || !integer(value.ownFrom) || typeof value.main !== 'boolean' ||
      (value.turn !== null && !integer(value.turn)) || (value.open !== null && !integer(value.open)) ||
      !Array.isArray(value.stepped) || !value.stepped.every(integer) ||
      !Array.isArray(value.claimed) || !value.claimed.every(integer) ||
      !Array.isArray(value.approvals) || !value.approvals.every(id => typeof id === 'string') ||
      typeof value.droppedUnrun !== 'boolean') throw new TypeError('Invalid completion checkpoint');
    if (value.accounting !== null) {
      const end = value.accounting;
      if (!end || !integer(end.turn) || !integer(end.seq) || typeof end.kind !== 'string' ||
        !PHASES.has(end.goalPhase) || (end.goalId !== null && typeof end.goalId !== 'string')) throw new TypeError('Invalid accounting end');
    }
    const state = { ...value, goal: goalDefinition.stateSchema.parse(value.goal) };
    return { ...state, view: viewOf(state) };
  } };
  return {
    key: COMPLETION_KEY, stateVersion: 1, stateSchema,
    init(header = {}, inheritedEventCount = 0) {
      const state = { ownFrom: integer(inheritedEventCount) ? inheritedEventCount : 0,
        main: header.origin !== 'subagent' && (header.delegationDepth ?? 0) === 0,
        turn: null, open: null, stepped: [], claimed: [], approvals: [],
        accounting: null, droppedUnrun: false, goal: goalDefinition.init() };
      return { ...state, view: viewOf(state) };
    },
    apply(state, event) {
      if (!event || !integer(event.seq)) return state;
      // Goal replay covers the complete history using the SDK's strict fold;
      // consumed work is restricted to this Session's owned suffix.
      const goal = goalDefinition.apply(state.goal, event);
      let next = goal === state.goal ? state : { ...state, goal };
      if (event.seq < state.ownFrom) return next === state ? state : { ...next, view: viewOf(next) };
      const data = event.data ?? {};
      switch (event.type) {
        case 'turn/start':
          if (!integer(data.turn) || state.turn !== null && data.turn <= state.turn) break;
          next = { ...next, turn: data.turn, open: data.turn, approvals: [] };
          break;
        case 'step/start':
          if (!integer(data.turn) || data.turn !== state.open || state.stepped.includes(data.turn)) break;
          next = { ...next, stepped: [...state.stepped, data.turn] };
          break;
        case 'agent/inbox/spliced':
          if (data.removedCount === undefined) break;
          if (data.outcome === 'canceled') {
            if (Array.isArray(data.inserted) && data.inserted.length === 0 && !next.droppedUnrun) next = { ...next, droppedUnrun: true };
          } else if (state.open !== null && !state.claimed.includes(state.open)) next = { ...next, claimed: [...state.claimed, state.open] };
          break;
        case 'approval/asked':
          if (typeof data.id === 'string' && !state.approvals.includes(data.id)) next = { ...next, approvals: [...state.approvals, data.id] };
          break;
        case 'approval/decided':
          if (state.approvals.includes(data.id)) next = { ...next, approvals: state.approvals.filter(id => id !== data.id) };
          break;
        case 'turn/end': {
          if (!integer(data.turn) || data.turn !== state.open || typeof data.reason?.kind !== 'string') break;
          const kind = data.reason.kind;
          const accounted = state.stepped.includes(data.turn) || state.claimed.includes(data.turn) && kind !== 'completed';
          next = { ...next, open: null, approvals: [],
            stepped: state.stepped.filter(turn => turn !== data.turn), claimed: state.claimed.filter(turn => turn !== data.turn),
            ...(accounted ? { droppedUnrun: false, accounting: { turn: data.turn, kind, seq: event.seq,
              goalPhase: phaseOf(goal), goalId: goal.current?.goal?.id ?? null } } : {}) };
          break;
        }
        default: break;
      }
      return next === state ? state : { ...next, view: viewOf(next) };
    },
    wire: { viewSchema: { parse: parseCompletionView }, view: state => state.view },
  };
}
