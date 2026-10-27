import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, reduce, count } from '../state.mjs';

const start = (sessionId = 'main', turn = 1, extra = {}) => ({ type: 'turn/start', sessionId, turn, ...extra });
const end = (reason = 'completed', sessionId = 'main', turn = 1, extra = {}) => ({
  type: 'turn/end', sessionId, turn,
  reason: typeof reason === 'string' ? { kind: reason } : reason,
  ...extra,
});
const waiting = (interactionId = 'q1', sessionId = 'main', turn = 1, interaction = 'question', extra = {}) => ({
  type: 'waiting/start', sessionId, turn, interaction, interactionId, ...extra,
});
const resolved = (...args) => ({ ...waiting(...args), type: 'waiting/resolved' });
const actions = (state, ...items) => items.reduce(reduce, state);
const background = () => createState();

// Object.freeze(Map) does not freeze entries; compare snapshots after reduces.
function snapshot(state) {
  return {
    ...state,
    sessions: [...state.sessions].map(([id, value]) => [id, {
      ...value,
      interactions: [...value.interactions],
      seenInteractions: [...value.seenInteractions],
    }]),
    pending: [...state.pending],
    disposed: [...state.disposed],
  };
}

test('restart creates independent empty state, with no shared collections', () => {
  const first = actions(background(), start(), end());
  const restarted = createState();
  assert.equal(count(first), 1);
  assert.equal(count(restarted), 0);
  assert.equal(restarted.sessions.size, 0);
  assert.notEqual(first.sessions, restarted.sessions);
  assert.notEqual(first.pending, restarted.pending);
});

test('live completion counts once; duplicate end and duplicate start do not replay', () => {
  const state = actions(background(), start(), end());
  assert.equal(count(state), 1);
  assert.equal(state.pending.get('main').reason, 'completed');
  assert.equal(reduce(state, end()), state);
  assert.equal(reduce(state, start()), state);
});

test('different main sessions count once each, regardless of multiple events', () => {
  const state = actions(background(), start('a'), end('error', 'a'),
    start('b'), waiting('q1', 'b'), waiting('q2', 'b'), start('c'), end('completed', 'c'));
  assert.equal(count(state), 3);
  assert.equal(state.sessions.get('b').interactions.size, 2);
});

test('new main turn retains unread result until it is viewed', () => {
  const before = actions(background(), start('a'), end('completed', 'a'), start('b'), end('error', 'b'));
  const after = reduce(before, start('a', 2));
  assert.equal(count(after), 2);
  assert.equal(after.pending.has('a'), true);
  assert.equal(after.pending.has('b'), true);
  assert.equal(count(reduce(after, end('completed', 'a', 2))), 2);
});

test('subagent events are ignored, including interactions and disposal', () => {
  const state = actions(background(), start(), end());
  for (const action of [start('child', 1, { delegationDepth: 1 }),
    end('error', 'child', 1, { delegationDepth: 2 }),
    waiting('q', 'child', 1, 'question', { delegationDepth: 1 }),
    resolved('q', 'child', 1, 'question', { delegationDepth: 1 }),
    { type: 'session/dispose', sessionId: 'main', delegationDepth: 1 },
    end('error', 'child', 1, { isSubagent: true })]) assert.equal(reduce(state, action), state);
  assert.equal(count(state), 1);
});

test('depth zero and missing depth both identify main sessions', () => {
  const state = actions(background(), start('zero', 1, { delegationDepth: 0 }),
    end('completed', 'zero', 1, { delegationDepth: 0 }), start('absent'), end('completed', 'absent'));
  assert.equal(count(state), 2);
});

test('read is per-session revision CAS; no focus action exists', () => {
  const state = actions(background(), start('a'), end('error','a'), start('b'), end('completed','b'));
  for (const action of [{type:'focus',focused:true}, {type:'read',sessionId:'a'},
    {type:'read',sessionId:'a',revision:999},{type:'read',sessionId:'missing',revision:1}]) {
    assert.equal(reduce(state,action),state);
  }
  const read = {type:'read',sessionId:'a',revision:state.pending.get('a').revision};
  const after=reduce(state,read);
  assert.equal(count(after),1); assert.equal(after.pending.has('b'),true);
  assert.equal(reduce(after,read),after);
});
test('old turn result survives a new turn and waiting resolution', () => {
  let state=actions(background(),start(),end(),start('main',2),waiting('q','main',2));
  assert.equal(count(state),1); assert.equal(state.pending.get('main').kind,'terminal');
  state=reduce(state,resolved('q','main',2));
  assert.equal(count(state),1); assert.equal(state.pending.get('main').turn,1);
  state=reduce(state,{type:'read',sessionId:'main',revision:state.pending.get('main').revision});
  assert.equal(count(state),0);
});
test('reading an old result leaves a new waiting interaction counted', () => {
  let state=actions(background(),start(),end(),start('main',2),waiting('q','main',2));
  state=reduce(state,{type:'read',sessionId:'main',revision:state.pending.get('main').revision});
  assert.equal(count(state),1); assert.equal(state.pending.get('main').kind,'waiting');
  state=reduce(state,resolved('q','main',2)); assert.equal(count(state),0);
});
test('read-before-new-result and new-result-before-old-read are both safe', () => {
  const before=actions(background(),start(),end());
  const ack={type:'read',sessionId:'main',revision:before.pending.get('main').revision};
  const first=actions(before,ack,start('main',2),end('completed','main',2));
  const second=actions(before,start('main',2),end('completed','main',2),ack);
  assert.equal(count(first),1); assert.equal(count(second),1);
  assert.equal(second.pending.get('main').turn,2);
});

for (const reason of ['completed', 'error', 'blocked', 'max-tokens']) {
  test(`${reason} creates a terminal pending item`, () => {
    const state = actions(background(), start(), end(reason));
    assert.equal(count(state), 1);
    assert.equal(state.pending.get('main').reason, reason);
  });
}

for (const kind of ['user', 'disposed', 'parent', 'hook']) {
  test(`aborted/${kind} clears current waiting but does not notify by default`, () => {
    const state = actions(background(), start(), waiting(), end({ kind: 'aborted', reason: { kind } }));
    assert.equal(count(state), 0);
    assert.equal(state.sessions.get('main').ended, true);
    assert.equal(state.sessions.get('main').interactions.size, 0);
  });
}

for (const reason of ['interrupted', 'forked']) {
  test(`historical ${reason} is wholly ignored, not a live stop`, () => {
    const empty = background();
    assert.equal(reduce(empty, end(reason)), empty);
    const pending = actions(empty, start(), waiting());
    assert.equal(reduce(pending, end(reason)), pending);
  });
}

test('unknown/malformed reasons ignored; string reasons also supported', () => {
  const state = actions(background(), start());
  for (const reason of [undefined, null, {}, { kind: 'future' }]) {
    assert.equal(reduce(state, { type: 'turn/end', sessionId: 'main', turn: 1, reason }), state);
  }
  assert.equal(count(reduce(state, { type: 'turn/end', sessionId: 'main', turn: 1, reason: 'completed' })), 1);
});

test('matching waiting resolution clears waiting and duplicate resolution is harmless', () => {
  const before = actions(background(), start(), waiting());
  assert.equal(count(before), 1);
  assert.equal(reduce(before, waiting()), before);
  const after = reduce(before, resolved());
  assert.equal(count(after), 0);
  assert.equal(reduce(after, resolved()), after);
});

test('multiple interactions share one count and resolve independently', () => {
  let state = actions(background(), start(), waiting('same', 'main', 1, 'approval'), waiting('same', 'main', 1, 'question'));
  assert.equal(count(state), 1);
  assert.equal(state.sessions.get('main').interactions.size, 2);
  state = reduce(state, resolved('same', 'main', 1, 'approval'));
  assert.equal(count(state), 1);
  assert.equal(state.sessions.get('main').interactions.size, 1);
  state = reduce(state, resolved('same', 'main', 1, 'question'));
  assert.equal(count(state), 0);
});

test('completion replaces waiting; late resolution cannot clear completion', () => {
  const completed = actions(background(), start(), waiting(), end());
  assert.equal(count(completed), 1);
  assert.equal(completed.pending.get('main').kind, 'terminal');
  assert.equal(completed.sessions.get('main').interactions.size, 0);
  assert.equal(reduce(completed, resolved()), completed);
  assert.equal(reduce(completed, waiting('late')), completed);
});

test('resolve-before-completion works; resolve-before-start cannot resurrect waiting', () => {
  const first = actions(background(), start(), waiting(), resolved(), end('error'));
  assert.equal(count(first), 1);
  assert.equal(first.pending.get('main').reason, 'error');
  const second = actions(background(), start(), resolved('out-of-order'));
  assert.equal(count(second), 0);
  assert.equal(reduce(second, waiting('out-of-order')), second);
});

test('resolving one request never deletes a newer different waiting request', () => {
  const state = actions(background(), start(), waiting('old'), resolved('old'), waiting('new'));
  assert.equal(reduce(state, resolved('old')), state);
  assert.equal(count(state), 1);
  assert.equal(state.sessions.get('main').interactions.size, 1);
});

test('stale previous-turn resolve cannot delete current wait with reused id', () => {
  let state = actions(background(), start(), waiting('reuse'), end(), start('main', 2), waiting('reuse', 'main', 2));
  assert.equal(count(state), 1);
  assert.equal(reduce(state, resolved('reuse', 'main', 1)), state);
  assert.equal(reduce(state, end('error', 'main', 1)), state);
  assert.equal(reduce(state, start('main', 1)), state);
  state = reduce(state, resolved('reuse', 'main', 2));
  assert.equal(count(state), 1); // Earlier terminal result remains unread.
});

test('waiting ids and session ids containing delimiters cannot collide', () => {
  let state = actions(background(), start('a:question:b'), start('a'),
    waiting('b:c', 'a'), waiting('c', 'a:question:b'));
  assert.equal(count(state), 2);
  state = reduce(state, resolved('b:c', 'a'));
  assert.equal(count(state), 1);
  assert.equal(state.pending.has('a:question:b'), true);
});

test('dispose cleans state, ignores late events, a new start revives the session', () => {
  const before = actions(background(), start(), waiting());
  const disposed = reduce(before, { type: 'session/dispose', sessionId: 'main' });
  assert.equal(count(disposed), 0);
  assert.equal(disposed.sessions.has('main'), true); // Turn dedup survives object unload.
  assert.equal(reduce(disposed, end()), disposed);
  assert.equal(reduce(disposed, waiting('late')), disposed);
  assert.equal(reduce(disposed, { type: 'session/dispose', sessionId: 'main' }), disposed);
  const revived = actions(disposed, start('main', 2), end('completed', 'main', 2));
  assert.equal(count(revived), 1);
  assert.equal(revived.disposed.has('main'), false);
});

test('disable clears pending; disabled-time events do not replay on enable', () => {
  const initial = actions(background(), start(), waiting());
  const disabled = reduce(initial, { type: 'enabled', enabled: false });
  assert.equal(count(disabled), 0);
  const observed = actions(disabled, end(), start('other'), waiting('q', 'other'));
  assert.equal(observed.pending.size, 0);
  const enabled = reduce(observed, { type: 'enabled', enabled: true });
  assert.equal(count(enabled), 0);
  assert.equal(reduce(enabled, end()), enabled);
  assert.equal(reduce(enabled, waiting('q', 'other')), enabled);
  const fresh = actions(enabled, start('main', 2), end('completed', 'main', 2));
  assert.equal(count(fresh), 1);
});

test('initially disabled receives no pending items; focus remains independent', () => {
  const state = actions(createState({ enabled: false }), start(), end(), { type: 'focus', focused: true });
  assert.equal(count(state), 0);
  assert.equal(state.pending.size, 0);
  assert.equal('focused' in state, false);
  assert.equal(count(reduce(state, { type: 'enabled', enabled: true })), 0);
});

test('unknown or invalid actions are no-ops', () => {
  const state = background();
  for (const action of [null, undefined, 'x', {}, { type: 'unknown', sessionId: 'a' },
    { type: 'focus', focused: 'yes' }, { type: 'enabled', enabled: 0 },
    start(''), start('   '), waiting('', 'a'), waiting('q', 'a', 1, 'unsupported')]) {
    assert.equal(reduce(state, action), state);
  }
});

test('no-turn live events work; duplicate open starts do not clear waiting', () => {
  const begin = { type: 'turn/start', sessionId: 'main' };
  const wait = { type: 'waiting/start', sessionId: 'main', interaction: 'approval', interactionId: 0 };
  const state = actions(background(), begin, wait);
  assert.equal(count(state), 1);
  assert.equal(reduce(state, begin), state);
  const completed = reduce(state, { type: 'turn/end', sessionId: 'main', reason: 'completed' });
  assert.equal(count(completed), 1);
  assert.equal(count(reduce(completed, begin)), 1);
});

test('mid-turn subscription accepts live end but same/older start cannot replay', () => {
  const state = reduce(background(), end('completed', 'main', 7));
  assert.equal(count(state), 1);
  assert.equal(reduce(state, start('main', 7)), state);
  assert.equal(reduce(state, start('main', 6)), state);
  assert.equal(count(reduce(state, start('main', 8))), 1);
});

test('unknown turn adopts the first live turn identity to reject later stale events', () => {
  const begin = { type: 'turn/start', sessionId: 'main' };
  const state = actions(background(), begin, waiting('reuse', 'main', 4));
  assert.equal(state.sessions.get('main').turn, 4);
  assert.equal(reduce(state, resolved('reuse', 'main', 3)), state);
  assert.equal(count(reduce(state, resolved('reuse', 'main', 4))), 0);
});

test('numeric session ids work including zero', () => {
  const state = actions(background(), start(0), end('completed', 0));
  assert.equal(count(state), 1);
  assert.equal(state.pending.has('0'), true);
});

test('count caps at 999 without losing actual session records', () => {
  let state = background();
  for (let i = 0; i < 1002; i += 1) state = reduce(state, end('completed', `session-${i}`));
  assert.equal(state.pending.size, 1002);
  assert.equal(count(state), 999);
  for (let i = 0; i < 5; i += 1) state = reduce(state, { type: 'read', sessionId: `session-${i}`, revision: state.pending.get(`session-${i}`).revision });
  assert.equal(count(state), 997);
});

test('all transitions preserve old state and collection entries', () => {
  let state = background();
  for (const action of [start(), waiting(), waiting('q2'), resolved(), end(),
    { type: 'focus', focused: true }, { type: 'focus', focused: false }, start('main', 2),
    waiting('q3', 'main', 2), { type: 'enabled', enabled: false }, { type: 'enabled', enabled: true },
    { type: 'session/dispose', sessionId: 'main' }]) {
    const before = snapshot(state);
    Object.freeze(state);
    const after = reduce(state, action);
    assert.deepEqual(snapshot(state), before);
    state = after;
  }
});
