/** Small host-only log projection. Unread/focus is ephemeral and never written to the session. */
export const KEY = 'nativeTaskbarBadgeTurn';
const phases = new Set(['none', 'active', 'paused', 'blocked', 'complete']);
export const definition = {
  key: KEY,
  stateVersion: 1,
  stateSchema: {
    parse(value) {
      if (!value || !Number.isSafeInteger(value.turn) || value.turn < 0 || !phases.has(value.goalPhase)) {
        throw new TypeError(`${KEY}: invalid checkpoint`);
      }
      return { turn: value.turn, goalPhase: value.goalPhase };
    },
  },
  init: () => ({ turn: 0, goalPhase: 'none' }),
  apply(state, event) {
    if (event.type === 'turn/start' && Number.isSafeInteger(event.data?.turn) && event.data.turn >= 0) {
      return state.turn === event.data.turn ? state : { ...state, turn: event.data.turn };
    }
    if (event.type === 'goal/change') {
      const goalPhase = event.data?.operation === 'clear' ? 'none' : event.data?.goal?.phase;
      return phases.has(goalPhase) && goalPhase !== state.goalPhase ? { ...state, goalPhase } : state;
    }
    return state;
  },
};
