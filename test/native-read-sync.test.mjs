import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeReadReceipt, applyNativeReadSync, CHANNEL } from '../read-client.mjs';
import { createController } from '../controller.mjs';
import { createBridge } from '../bridge.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; }
function source(value) {
  const listeners = new Set();
  return { getSnapshot: () => value, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(next) { value = next; for (const fn of [...listeners]) fn(); },
    emit() { for (const fn of [...listeners]) fn(); }, listeners };
}
function clock() {
  const timers = new Map(); let next = 0;
  return { timers,
    schedule(fn, delay) { const id = ++next; timers.set(id, { fn, delay }); return id; },
    cancel(id) { timers.delete(id); },
    fire() { assert.equal(timers.size, 1, 'one foreground heartbeat only'); const [id, timer] = timers.entries().next().value;
      assert.equal(timer.delay, 2000); timers.delete(id); timer.fn(); },
  };
}
function fixture({ createDriver = true } = {}) {
  const counts = [], controller = createController({ onCount: value => counts.push(value) });
  const bridge = createBridge(controller), owner = { principal: { kind: 'owner' }, signal: new AbortController().signal };
  const time = clock(), calls = [], errors = []; let seq = 0, handler = null, activeCalls = 0, maxActiveCalls = 0;
  let view = { sessionId: 'a', ready: true, active: true, nativeRead: true, visible: true, focused: true };
  let generation = { id: 1 };
  const session = id => ({ id, header: { delegationDepth: 0 } });
  const start = (id, turn = 1) => controller.sessionEvent(session(id), { type: 'turn/start', seq: ++seq, data: { turn } });
  const end = (id, turn = 1, kind = 'completed') => {
    const eventSeq = ++seq;
    controller.sessionEvent(session(id), { type: 'turn/end', seq: eventSeq, data: { turn, reason: { kind } } });
    return eventSeq;
  };
  const finish = (id, turn = 1, kind = 'completed') => { start(id, turn); return end(id, turn, kind); };
  const direct = (endpoint, payload, signal) => bridge(endpoint, payload, signal, owner);
  const rpc = async (channel, endpoint, payload, signal) => {
    assert.equal(channel, CHANNEL);
    const call = { endpoint, payload: structuredClone(payload), signal, result: undefined }; calls.push(call);
    activeCalls++; maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
    try { call.result = await (handler ? handler(call, direct) : direct(endpoint, payload, signal)); return call.result; }
    finally { activeCalls--; }
  };
  const driver = createDriver ? createNativeReadReceipt({ getView: () => view, getGeneration: () => generation,
    call: rpc, schedule: time.schedule, cancel: time.cancel, onError: error => errors.push(error) }) : null;
  return { controller, counts, calls, errors, time, driver, rpc, session, start, end, finish,
    get maxActiveCalls() { return maxActiveCalls; },
    setHandler(fn) { handler = fn; },
    setView(patch) { view = { ...view, ...patch }; driver?.refresh(); },
    setGeneration(value) { generation = value; driver?.refresh(); },
    refresh() { driver.refresh(); },
    close() { driver?.stop(); assert.equal(time.timers.size, 0); },
  };
}
const reads = f => f.calls.filter(call => call.endpoint === 'read');
const pending = f => f.calls.filter(call => call.endpoint === 'pending');

function hub(initial = {}) {
  const events = new Map();
  return { ...initial, events, addEventListener(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); },
    removeEventListener(name, fn) { events.get(name)?.delete(fn); },
    emit(name) { for (const fn of [...(events.get(name) ?? [])]) fn(); } };
}
function applicationFixture({ unsupported = false } = {}) {
  const f = fixture({ createDriver: false });
  const list = source({ phase: 'ready', ids: ['a', 'b', 'c'], byId: {
    a: { id: 'a', blank: false, retainedBy: { mainView: 1 } },
    b: { id: 'b', blank: false, retainedBy: {} }, c: { id: 'c', blank: false, retainedBy: {} },
  } });
  const current = source({ key: 'a' }), statuses = source(new Map(['a', 'b', 'c'].map(id => [id, { completionUnread: false }])));
  const generation = source({ id: 1 }), effects = [];
  let focused = true;
  const document = hub({ visibilityState: 'visible', hasFocus: () => focused });
  const window = hub();
  const globals = { document, window, IntersectionObserver: undefined, setTimeout: f.time.schedule, clearTimeout: f.time.cancel };
  const descriptors = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  const ctx = { sessions: { list }, uiSession: { current, sessionStatus: unsupported ? undefined : statuses },
    connection: { generation, rpc: { call: f.rpc } },
    effect(fn) { const cleanup = fn(); let live = true; const dispose = () => { if (live) { live = false; cleanup?.(); } }; effects.push(dispose); return dispose; },
  };
  let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; for (const fn of effects.reverse()) fn(); };
  return { ...f, ctx, list, current, statuses, generation, document, window, effects,
    get maxActiveCalls() { return f.maxActiveCalls; },
    mount: () => applyNativeReadSync(ctx), dispose,
    setFocused(value) { focused = value; window.emit(value ? 'focus' : 'blur'); },
    close() {
      dispose();
      try { assert.equal(f.time.timers.size, 0); for (const s of [list, current, statuses, generation]) assert.equal(s.listeners.size, 0);
        for (const target of [document, window]) for (const listeners of target.events.values()) assert.equal(listeners.size, 0); }
      finally { for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
      } }
    },
  };
}

test('native policy acknowledges only the foreground current terminal, not all false unread flags', async () => {
  const f = fixture();
  try { for (const id of ['a', 'b', 'c']) f.finish(id); const item = f.controller.pendingFor('a');
    f.refresh(); await tick();
    assert.equal(f.controller.snapshot().pendingCount, 2); assert.equal(f.controller.pendingFor('a'), null);
    assert.ok(f.controller.pendingFor('b')); assert.ok(f.controller.pendingFor('c'));
    assert.deepEqual(f.calls.map(call => call.endpoint), ['pending', 'read']);
    assert.deepEqual(reads(f)[0].payload, { sessionId: 'a', kind: 'terminal', revision: item.revision, turn: item.turn, eventSeq: item.eventSeq });
    assert.equal(f.time.timers.size, 1); assert.equal(f.maxActiveCalls, 1);
  } finally { f.close(); }
});

for (const [field, value] of [['active', false], ['ready', false], ['nativeRead', false], ['visible', false], ['focused', false], ['sessionId', undefined], ['sessionId', '']]) {
  test(`native policy makes no requests or timers when ${field}=${String(value)}`, async () => {
    const f = fixture(); try { f.finish('a'); f.setView({ [field]: value }); await tick(); assert.equal(f.calls.length, 0);
      assert.equal(f.time.timers.size, 0); assert.equal(f.controller.snapshot().pendingCount, 1); } finally { f.close(); }
  });
}

test('native policy requires an active connection generation', async () => {
  const f = fixture(); try { f.finish('a'); f.setGeneration(undefined); await tick(); assert.equal(f.calls.length, 0); assert.equal(f.time.timers.size, 0); } finally { f.close(); }
});

for (const transition of ['A-B-A', 'hidden-visible', 'blur-focus', 'unread-read', 'ready-roundtrip', 'new-generation-same-id']) {
  test(`stale pending response cannot read after ${transition}, even when final eligibility matches`, async () => {
    const f = fixture(), gate = deferred(); let first = true;
    try {
      f.finish('a');
      f.setHandler(async (call, direct) => { const result = direct(call.endpoint, call.payload, call.signal);
        if (call.endpoint === 'pending' && first) { first = false; await gate.promise; } return result; });
      f.refresh(); await tick(); const stale = pending(f)[0].signal;
      if (transition === 'A-B-A') { f.setView({ sessionId: 'b' }); f.setView({ sessionId: 'a' }); }
      if (transition === 'hidden-visible') { f.setView({ visible: false }); f.setView({ visible: true }); }
      if (transition === 'blur-focus') { f.setView({ focused: false }); f.setView({ focused: true }); }
      if (transition === 'unread-read') { f.setView({ nativeRead: false }); f.setView({ nativeRead: true }); }
      if (transition === 'ready-roundtrip') { f.setView({ ready: false }); f.setView({ ready: true }); }
      if (transition === 'new-generation-same-id') f.setGeneration({ id: 1 });
      assert.equal(stale.aborted, true); gate.release(); await tick();
      assert.equal(reads(f).some(call => call.signal === stale), false);
      assert.equal(pending(f).length, 2, 'a new attempt must obtain a fresh pending snapshot');
      assert.equal(f.controller.snapshot().pendingCount, 0, 'the new valid foreground proof may acknowledge');
      assert.equal(f.maxActiveCalls, 1); assert.equal(f.time.timers.size, 1);
    } finally { gate.release(); f.close(); }
  });
}

test('an unrelated notification aborts the outstanding evidence and coalesces to one rerun', async () => {
  const f = fixture(), gate = deferred(); let first = true;
  try { f.finish('a'); f.setHandler(async (call, direct) => { const result = direct(call.endpoint, call.payload, call.signal);
      if (first && call.endpoint === 'pending') { first = false; await gate.promise; } return result; });
    f.refresh(); await tick(); const old = pending(f)[0].signal;
    for (let i = 0; i < 20; i++) f.refresh();
    assert.equal(old.aborted, true); assert.equal(pending(f).length, 1); gate.release(); await tick();
    assert.equal(pending(f).length, 2); assert.equal(reads(f).length, 1); assert.notEqual(reads(f)[0].signal, old);
    assert.equal(f.maxActiveCalls, 1); assert.equal(f.time.timers.size, 1);
  } finally { gate.release(); f.close(); }
});

test('new completion between pending and read rejects the old CAS then retries the new revision', async () => {
  const f = fixture(); let replace = true;
  try { f.finish('a'); const before = f.controller.pendingFor('a');
    f.setHandler((call, direct) => { if (call.endpoint === 'read' && replace) { replace = false; f.finish('a', 2); } return direct(call.endpoint, call.payload, call.signal); });
    f.refresh(); await tick(); assert.equal(reads(f)[0].result.value.accepted, false);
    assert.notEqual(f.controller.pendingFor('a').revision, before.revision); assert.equal(f.controller.pendingFor('a').turn, 2);
    f.time.fire(); await tick(); assert.equal(reads(f)[1].payload.turn, 2); assert.equal(reads(f)[1].result.value.accepted, true);
    assert.equal(f.controller.snapshot().pendingCount, 0);
  } finally { f.close(); }
});

test('a later completion after successful acknowledgement is discovered without switching views', async () => {
  const f = fixture(); try { f.finish('a'); f.refresh(); await tick(); assert.equal(f.controller.snapshot().pendingCount, 0);
    f.finish('a', 2); assert.equal(f.controller.snapshot().pendingCount, 1);
    f.time.fire(); await tick(); assert.equal(f.controller.snapshot().pendingCount, 0); assert.equal(reads(f).length, 2);
    assert.notEqual(reads(f)[0].payload.revision, reads(f)[1].payload.revision); assert.equal(f.time.timers.size, 1);
  } finally { f.close(); }
});

test('native current-view read may retire an old terminal across a newer running turn without suppressing its later result', async () => {
  const f = fixture(); try { const end = f.finish('a', 1); f.start('a', 2); f.refresh(); await tick();
    assert.equal(reads(f)[0].payload.turn, 1); assert.equal(reads(f)[0].payload.eventSeq, end); assert.equal(f.controller.snapshot().pendingCount, 0);
    f.end('a', 2); assert.equal(f.controller.snapshot().pendingCount, 1); f.time.fire(); await tick();
    assert.equal(reads(f)[1].payload.turn, 2); assert.equal(f.controller.snapshot().pendingCount, 0);
  } finally { f.close(); }
});

test('pure waiting is never cleared and a terminal plus waiting retains the real interaction', async () => {
  const f = fixture(); try {
    f.start('a', 1); const first = f.controller.questionStarted({ name: 'ask_user_question', callId: 'q1', agent: { session: f.session('a') } }, { turn: 1 });
    f.refresh(); await tick(); assert.equal(reads(f).length, 0); assert.equal(f.controller.pendingFor('a').kind, 'waiting');
    f.controller.questionResolved(first); f.end('a', 1); f.start('a', 2);
    const second = f.controller.questionStarted({ name: 'ask_user_question', callId: 'q2', agent: { session: f.session('a') } }, { turn: 2 });
    assert.equal(f.controller.pendingFor('a').kind, 'terminal'); assert.ok(f.controller.pendingFor('a').waiting);
    f.time.fire(); await tick(); assert.equal(reads(f).length, 1); assert.equal(f.controller.pendingFor('a').kind, 'waiting');
    assert.equal(f.controller.snapshot().pendingCount, 1); f.time.fire(); await tick(); assert.equal(reads(f).length, 1);
    f.controller.questionResolved(second); assert.equal(f.controller.snapshot().pendingCount, 0);
  } finally { f.close(); }
});

test('null/error snapshots retry only on the single bounded foreground heartbeat', async () => {
  const f = fixture(); let fail = false;
  try { f.refresh(); await tick(); assert.equal(pending(f).length, 1); assert.equal(reads(f).length, 0); assert.equal(f.time.timers.size, 1);
    f.setHandler(() => { if (fail) throw new Error('offline'); return { ok: false, error: { code: 'unavailable' } }; });
    f.time.fire(); await tick(); assert.equal(pending(f).length, 2); assert.equal(f.time.timers.size, 1);
    fail = true; f.time.fire(); await tick(); assert.equal(pending(f).length, 3); assert.equal(f.errors.length, 1); assert.equal(f.time.timers.size, 1);
    f.setView({ visible: false }); await tick(); assert.equal(f.time.timers.size, 0); const before = f.calls.length;
    f.refresh(); await tick(); assert.equal(f.calls.length, before); assert.equal(f.time.timers.size, 0);
  } finally { f.close(); }
});

test('blur before delivery cancels the read; blur after a committed read cannot undo the existing CAS', async () => {
  for (const commitFirst of [false, true]) {
    const f = fixture(), gate = deferred();
    try { f.finish('a'); f.setHandler(async (call, direct) => {
        if (call.endpoint !== 'read') return direct(call.endpoint, call.payload, call.signal);
        const result = commitFirst ? direct(call.endpoint, call.payload, call.signal) : null;
        await gate.promise;
        return commitFirst ? result : direct(call.endpoint, call.payload, call.signal);
      });
      f.refresh(); await tick(); assert.equal(reads(f).length, 1); f.setView({ focused: false }); gate.release(); await tick();
      assert.equal(reads(f)[0].signal.aborted, true); assert.equal(f.controller.snapshot().pendingCount, commitFirst ? 0 : 1);
      assert.equal(f.time.timers.size, 0);
    } finally { gate.release(); f.close(); }
  }
});

test('stop during a pending request prevents late reads, reruns and timers', async () => {
  const f = fixture(), gate = deferred();
  try { f.finish('a'); f.setHandler(async (call, direct) => { const result = direct(call.endpoint, call.payload, call.signal); await gate.promise; return result; });
    f.refresh(); await tick(); f.driver.stop(); f.refresh(); gate.release(); await tick();
    assert.equal(pending(f)[0].signal.aborted, true); assert.equal(reads(f).length, 0); assert.equal(f.time.timers.size, 0); assert.equal(f.controller.snapshot().pendingCount, 1);
  } finally { gate.release(); f.close(); }
});

test('full application wiring reads without any mounted tail or IntersectionObserver and never bulk-clears a fresh page', async () => {
  const f = applicationFixture();
  try { for (const id of ['a', 'b', 'c']) f.finish(id); assert.equal(f.mount(), true); await tick();
    assert.equal(f.controller.snapshot().pendingCount, 2); assert.equal(f.controller.pendingFor('a'), null);
    assert.ok(f.controller.pendingFor('b')); assert.ok(f.controller.pendingFor('c'));
    for (const src of [f.list, f.current, f.statuses, f.generation]) assert.equal(src.listeners.size, 1);
    assert.equal(f.time.timers.size, 1); assert.equal(f.maxActiveCalls, 1);
    f.current.set({ key: 'b' }); await tick(); assert.ok(f.controller.pendingFor('b'), 'current key alone is not retention proof');
    const old = f.list.getSnapshot(); f.list.set({ ...old, byId: { ...old.byId, a: { ...old.byId.a, retainedBy: {} }, b: { ...old.byId.b, retainedBy: { mainView: 1 } } } });
    await tick(); assert.equal(f.controller.pendingFor('b'), null); assert.ok(f.controller.pendingFor('c'));
  } finally { f.close(); }
});

for (const invalid of ['pending-list', 'blank', 'missing-blank', 'null-blank', 'numeric-blank', 'string-blank',
  'subagent', 'delegated', 'no-retention', 'string-retention', 'boolean-retention', 'infinite-retention', 'fractional-retention',
  'missing-status', 'unread', 'truthy-read', 'no-current']) {
  test(`application qualification fails closed for ${invalid}`, async () => {
    const f = applicationFixture();
    try { f.finish('a'); const list = f.list.getSnapshot();
      if (invalid === 'pending-list') f.list.set({ ...list, phase: 'pending' });
      if (invalid === 'blank') f.list.set({ ...list, byId: { ...list.byId, a: { ...list.byId.a, blank: true } } });
      const blankCases = { 'missing-blank': undefined, 'null-blank': null, 'numeric-blank': 0, 'string-blank': 'unknown' };
      if (Object.hasOwn(blankCases, invalid)) f.list.set({ ...list, byId: { ...list.byId, a: { ...list.byId.a, blank: blankCases[invalid] } } });
      const retentionCases = { 'string-retention': '1', 'boolean-retention': true, 'infinite-retention': Infinity, 'fractional-retention': 1.5 };
      if (Object.hasOwn(retentionCases, invalid)) f.list.set({ ...list, byId: { ...list.byId, a: { ...list.byId.a, retainedBy: { mainView: retentionCases[invalid] } } } });
      if (invalid === 'subagent') f.list.set({ ...list, byId: { ...list.byId, a: { ...list.byId.a, origin: 'subagent' } } });
      if (invalid === 'delegated') f.list.set({ ...list, byId: { ...list.byId, a: { ...list.byId.a, delegationDepth: 1 } } });
      if (invalid === 'no-retention') f.list.set({ ...list, byId: { ...list.byId, a: { ...list.byId.a, retainedBy: {} } } });
      if (invalid === 'missing-status') f.statuses.set(new Map());
      if (invalid === 'unread') f.statuses.set(new Map([['a', { completionUnread: true }]]));
      if (invalid === 'truthy-read') f.statuses.set(new Map([['a', { completionUnread: 0 }]]));
      if (invalid === 'no-current') f.current.set({ key: undefined });
      assert.equal(f.mount(), true); await tick(); assert.equal(f.calls.length, 0); assert.equal(f.time.timers.size, 0); assert.equal(f.controller.snapshot().pendingCount, 1);
    } finally { f.close(); }
  });
}

test('application events abort outstanding evidence and dispose releases every public subscription/listener/timer', async () => {
  const f = applicationFixture(), gate = deferred(); let first = true;
  try { f.finish('a'); f.setHandler(async (call, direct) => { const result = direct(call.endpoint, call.payload, call.signal);
      if (call.endpoint === 'pending' && first) { first = false; await gate.promise; } return result; });
    f.mount(); await tick(); const old = pending(f)[0].signal;
    f.document.visibilityState = 'hidden'; f.document.emit('visibilitychange'); f.document.visibilityState = 'visible'; f.document.emit('visibilitychange');
    f.setFocused(false); f.setFocused(true); f.list.emit(); f.current.emit(); f.statuses.emit(); f.generation.emit();
    assert.equal(old.aborted, true); f.dispose(); gate.release(); await tick();
    assert.equal(reads(f).length, 0); assert.equal(pending(f).length, 1); assert.equal(f.time.timers.size, 0); assert.equal(f.controller.snapshot().pendingCount, 1);
  } finally { gate.release(); f.close(); }
});

test('unsupported older SDK declines application sync without installing effects', () => {
  const f = applicationFixture({ unsupported: true });
  try { assert.equal(f.mount(), false); assert.equal(f.effects.length, 0); assert.equal(f.calls.length, 0); }
  finally { f.close(); }
});
