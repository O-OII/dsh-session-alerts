import test from 'node:test';
import assert from 'node:assert/strict';
import { definition, KEY } from '../projection.mjs';

const event = (type, data = {}) => ({ type, data });

test('projection init and checkpoint roundtrip contain only current turn and goal phase', () => {
  const state = definition.init();
  assert.equal(definition.key, KEY);
  assert.deepEqual(state, { turn: 0, goalPhase: 'none' });
  assert.deepEqual(definition.stateSchema.parse(state), state);
  assert.deepEqual(definition.stateSchema.parse({ ...state, ignored: 'extra' }), state);
});

test('projection tracks turn/start without mutating checkpoint or replaying unread state', () => {
  const initial = Object.freeze(definition.init());
  const turn = definition.apply(initial, event('turn/start', { turn: 4 }));
  assert.deepEqual(initial, { turn: 0, goalPhase: 'none' });
  assert.deepEqual(turn, { turn: 4, goalPhase: 'none' });
  assert.equal(definition.apply(turn, event('turn/start', { turn: 4 })), turn);
  assert.equal(definition.apply(turn, event('turn/end', { turn: 4, reason: { kind: 'completed' } })), turn);
  assert.equal('pending' in turn, false);
});

test('goal change tracks active/paused/blocked/complete and clear', () => {
  let state = definition.init();
  for (const phase of ['active', 'paused', 'blocked', 'complete']) {
    state = definition.apply(state, event('goal/change', { operation: 'update', goal: { phase } }));
    assert.equal(state.goalPhase, phase);
    assert.equal(definition.apply(state, event('goal/change', { goal: { phase } })), state);
  }
  assert.deepEqual(definition.apply(state, event('goal/change', { operation: 'clear' })), { turn: 0, goalPhase: 'none' });
});

test('projection ignores unrelated events and invalid goal phases', () => {
  const state = definition.init();
  for (const item of [event('assistant/message'), event('approval/asked'), event('goal/change'),
    event('goal/change', { goal: { phase: 'unknown' } }), event('turn/start', { turn: NaN }),
    event('turn/start', { turn: 1.5 }), event('turn/start', { turn: '3' })]) {
    assert.equal(definition.apply(state, item), state);
  }
});

test('invalid persisted checkpoints are rejected', () => {
  for (const value of [null, undefined, {}, { turn: -1, goalPhase: 'none' },
    { turn: 0.5, goalPhase: 'none' }, { turn: Number.MAX_SAFE_INTEGER + 1, goalPhase: 'none' },
    { turn: 1, goalPhase: 'invalid' }]) {
    assert.throws(() => definition.stateSchema.parse(value), TypeError);
  }
});

test('projection reducer must preserve schema validity for negative live turn numbers', () => {
  const state = definition.init();
  const after = definition.apply(state, event('turn/start', { turn: -1 }));
  assert.equal(after, state);
  assert.doesNotThrow(() => definition.stateSchema.parse(after));
});
