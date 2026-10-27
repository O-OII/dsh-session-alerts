import test from 'node:test';
import assert from 'node:assert/strict';
import { createController } from '../controller.mjs';

const session = (id = 'main', delegationDepth = 0) => ({ id, header: { id, delegationDepth } });
const event = (type, data = {}) => ({ type, data });
const begin = (turn = 1) => event('turn/start', { turn });
const finish = (kind = 'completed', turn = 1) => event('turn/end', { turn, reason: { kind } });
function setup(options = {}) {
  const counts = [], snapshots = [];
  const controller = createController({ onCount: n => counts.push(n), onChange: s => snapshots.push(s), ...options });
  return { controller, counts, snapshots };
}

test('controller counts before native readiness; focus is not an API', () => {
  const { controller, counts } = setup();
  controller.sessionEvent(session(), begin()); controller.sessionEvent(session(), finish());
  assert.equal(controller.snapshot().pendingCount, 1);
  assert.equal(controller.focus, undefined); assert.deepEqual(counts, [1]);
});
test('five sessions become four only through one exact read revision', () => {
  const { controller, counts } = setup();
  for (const id of ['a','b','c','d','e']) {
    controller.sessionEvent(session(id), begin()); controller.sessionEvent(session(id), finish());
  }
  const receipt = controller.pendingFor('c');
  assert.equal(controller.acknowledge(receipt), true);
  assert.equal(controller.snapshot().pendingCount, 4);
  assert.equal(controller.acknowledge(receipt), false);
  controller.sessionEvent(session('c'), finish());
  assert.equal(controller.snapshot().pendingCount, 4);
  assert.deepEqual(counts, [1,2,3,4,5,4]);
});
test('old revision, other session, old epoch and stale seq cannot read a new result', () => {
  const { controller } = setup(); const main = session();
  controller.sessionEvent(main, begin()); controller.sessionEvent(main, finish());
  const old = controller.pendingFor('main');
  controller.sessionEvent(main, begin(2)); controller.sessionEvent(main, finish('completed',2));
  assert.equal(controller.acknowledge(old), false);
  const current = controller.pendingFor('main');
  for (const bad of [{...current,sessionId:'other'},{...current,revision:old.revision},
    {...current,eventSeq:99},{...current,turn:1}]) assert.equal(controller.acknowledge(bad),false);
  const restarted = createController();
  restarted.sessionEvent(main, begin(2)); restarted.sessionEvent(main, finish('completed',2));
  assert.equal(restarted.acknowledge(current),false);
  assert.equal(controller.acknowledge(current),true);
});

test('question execution uses stable token, dedupes repeat, resolution pairs once', () => {
  const { controller, counts } = setup();
  const main = session();
  controller.sessionEvent(main, begin());
  const exec = { name: 'ask_user_question', callId: 'call-1', agent: { session: main } };
  const token = controller.questionStarted(exec, { turn: 1 });
  assert.equal(controller.questionStarted(exec, { turn: 1 }), token);
  assert.equal(controller.snapshot().pendingCount, 1);
  controller.questionResolved(token);
  controller.questionResolved(token);
  assert.equal(controller.snapshot().pendingCount, 0);
  assert.deepEqual(counts, [1, 0]);
});

test('question completion replaces waiting; finally resolution cannot clear completed badge', () => {
  const { controller, counts } = setup();
  const main = session();
  controller.sessionEvent(main, begin());
  const token = controller.questionStarted({ name: 'ask_user_question', callId: 'call-1', agent: { session: main } }, { turn: 1 });
  controller.sessionEvent(main, finish('error'));
  controller.questionResolved(token);
  assert.equal(controller.snapshot().pendingCount, 1);
  assert.deepEqual(counts, [1]);
});

test('different execution tokens sharing model-authored question ids remain independent', () => {
  const { controller } = setup();
  const main = session();
  controller.sessionEvent(main, begin());
  const make = callId => ({ name: 'ask_user_question', callId, arguments: { questions: [{ id: 'reused-model-id' }] }, agent: { session: main } });
  const first = controller.questionStarted(make('first'), { turn: 1 });
  const second = controller.questionStarted(make('second'), { turn: 1 });
  controller.questionResolved(first);
  assert.equal(controller.snapshot().pendingCount, 1);
  controller.questionResolved(second);
  assert.equal(controller.snapshot().pendingCount, 0);
});

test('local tokens are unique for executions without ids', () => {
  const { controller } = setup();
  const main = session();
  const first = controller.questionStarted({ name: 'ask_user_question', agent: { session: main } }, { turn: 1 });
  const second = controller.questionStarted({ name: 'ask_user_question', agent: { session: main } }, { turn: 1 });
  assert.notEqual(first.interactionId, second.interactionId);
  controller.questionResolved(first);
  assert.equal(controller.snapshot().pendingCount, 1);
  controller.questionResolved(second);
  assert.equal(controller.snapshot().pendingCount, 0);
});

test('stale finally resolution from earlier turn cannot remove later waiting', () => {
  const { controller } = setup();
  const main = session();
  controller.sessionEvent(main, begin());
  const old = controller.questionStarted({ name: 'ask_user_question', callId: 'reused', agent: { session: main } }, { turn: 1 });
  controller.sessionEvent(main, finish());
  controller.sessionEvent(main, begin(2));
  controller.questionStarted({ name: 'ask_user_question', callId: 'reused', agent: { session: main } }, { turn: 2 });
  controller.questionResolved(old);
  assert.equal(controller.snapshot().pendingCount, 1);
});

test('approval events use projection turn and coexist with question waits', () => {
  const { controller, counts } = setup();
  const main = session();
  controller.sessionEvent(main, begin(7));
  controller.sessionEvent(main, event('approval/asked', { id: 'same' }), { turn: 7 });
  const question = controller.questionStarted({ name: 'ask_user_question', callId: 'same', agent: { session: main } }, { turn: 7 });
  controller.sessionEvent(main, event('approval/decided', { id: 'same' }), { turn: 7 });
  assert.equal(controller.snapshot().pendingCount, 1);
  controller.questionResolved(question);
  assert.equal(controller.snapshot().pendingCount, 0);
  assert.deepEqual(counts, [1, 0]);
});

test('notifyOnWaiting false suppresses both approvals and questions but not completion', () => {
  const { controller } = setup({ notifyOnWaiting: false });
  const main = session();
  controller.sessionEvent(main, begin());
  controller.sessionEvent(main, event('approval/asked', { id: 'approval' }), { turn: 1 });
  assert.equal(controller.questionStarted({ name: 'ask_user_question', agent: { session: main } }, { turn: 1 }), null);
  assert.equal(controller.snapshot().pendingCount, 0);
  controller.sessionEvent(main, finish());
  assert.equal(controller.snapshot().pendingCount, 1);
});

test('notifyOnError false clears an old wait without alerting on error endings', () => {
  for (const reason of ['error', 'blocked', 'max-tokens']) {
    const { controller } = setup({ notifyOnError: false });
      const main = session();
    controller.sessionEvent(main, begin());
    controller.sessionEvent(main, event('approval/asked', { id: 'approval' }), { turn: 1 });
    assert.equal(controller.snapshot().pendingCount, 1);
    controller.sessionEvent(main, finish(reason));
    assert.equal(controller.snapshot().pendingCount, 0);
  }
});

test('active goal intermediate completed turns suppressed; goal completion/error still alerts', () => {
  const { controller } = setup();
  const main = session();
  controller.sessionEvent(main, begin());
  controller.sessionEvent(main, finish(), { turn: 1, goalPhase: 'active' });
  assert.equal(controller.snapshot().pendingCount, 0);
  controller.sessionEvent(main, begin(2));
  controller.sessionEvent(main, finish('completed', 2), { turn: 2, goalPhase: 'complete' });
  assert.equal(controller.snapshot().pendingCount, 1);
  controller.sessionEvent(main, begin(3));
  controller.sessionEvent(main, finish('error', 3), { turn: 3, goalPhase: 'active' });
  assert.equal(controller.snapshot().pendingCount, 1);
});

test('notifyOnGoalRounds true includes active goal completion rounds', () => {
  const { controller } = setup({ notifyOnGoalRounds: true });
  controller.sessionEvent(session(), begin());
  controller.sessionEvent(session(), finish(), { turn: 1, goalPhase: 'active' });
  assert.equal(controller.snapshot().pendingCount, 1);
});

test('history/cancel/subagents never create badges', () => {
  const { controller } = setup();
  for (const reason of ['interrupted', 'forked', 'aborted']) {
    const main = session(reason);
    controller.sessionEvent(main, begin());
    controller.sessionEvent(main, finish(reason));
  }
  const child = session('child', 1);
  controller.sessionEvent(child, begin());
  controller.sessionEvent(child, finish('error'));
  assert.equal(controller.questionStarted({ name: 'ask_user_question', agent: { session: child } }, { turn: 1 }), null);
  assert.equal(controller.snapshot().pendingCount, 0);
});

test('disable clears and re-enable does not replay disabled-time completion', () => {
  const { controller, counts } = setup();
  const main = session();
  controller.sessionEvent(main, begin());
  controller.sessionEvent(main, finish());
  controller.setEnabled(false);
  controller.sessionEvent(main, begin(2));
  controller.sessionEvent(main, finish('completed', 2));
  controller.setEnabled(true);
  controller.sessionEvent(main, finish('completed', 2));
  assert.equal(controller.snapshot().pendingCount, 0);
  assert.deepEqual(counts, [1, 0]);
});

test('object disposal retains unread terminal and rejects late completion', () => {
  const { controller } = setup();
  const main = session();
  controller.sessionEvent(main, begin());
  controller.sessionEvent(main, finish());
  const receipt = controller.pendingFor('main');
  controller.sessionDisposed(main);
  controller.sessionEvent(main, finish());
  assert.equal(controller.snapshot().pendingCount, 1);
  assert.equal(controller.acknowledge(receipt), true);
  assert.equal(controller.snapshot().pendingCount, 0);
});

test('numeric zero session id and missing metadata are handled safely', () => {
  const { controller } = setup();
  controller.sessionEvent(session(0), begin());
  controller.sessionEvent(session(0), finish());
  controller.sessionEvent(null, finish());
  controller.sessionEvent(session('x'), null);
  assert.equal(controller.questionStarted({ name: 'read' }), null);
  assert.equal(controller.snapshot().pendingCount, 1);
});
