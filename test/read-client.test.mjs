import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadReceipt, CHANNEL } from '../read-client.mjs';
import { createController } from '../controller.mjs';
import { createBridge } from '../bridge.mjs';
const tick = () => new Promise(resolve => setImmediate(resolve));
const owner = { principal: { kind: 'owner' }, signal: new AbortController().signal };
function fixture() {
  const counts = [], controller = createController({ onCount: n => counts.push(n) });
  const bridge = createBridge(controller);
  let seq = 0;
  const finish = (id, turn = 1) => {
    const session = { id, header: { delegationDepth: 0 } };
    controller.sessionEvent(session, { type: 'turn/start', seq: ++seq, data: { turn } });
    const eventSeq = ++seq;
    controller.sessionEvent(session, { type: 'turn/end', seq: eventSeq, data: { turn, reason: { kind: 'completed' } } });
    return eventSeq;
  };
  const timers = new Map(); let nextTimer = 0;
  const drivers = [];
  function windowFor(id, turn, eventSeq, options = {}) {
    let view = { sessionId: id, turn, eventSeq, active: true, visible: true, focused: true, intersecting: true, ...options };
    let generation = { id: 1 };
    const calls = [];
    const channelCall = async (channel, endpoint, payload, signal) => {
      assert.equal(channel, CHANNEL); calls.push({ endpoint, payload: structuredClone(payload), signal });
      return bridge(endpoint, payload, signal, owner);
    };
    const driver = createReadReceipt({
      getView: () => view, getGeneration: () => generation,
      call: (...args) => (window.call ?? channelCall)(...args),
      schedule(fn) { const key = ++nextTimer; timers.set(key, fn); return key; },
      cancel(key) { timers.delete(key); },
    });
    const window = { driver, calls, setView(patch) { view = { ...view, ...patch }; driver.refresh(); },
      reconnect(value) { generation = value; driver.refresh(); }, channelCall };
    drivers.push(driver);
    return window;
  }
  return { controller, bridge, finish, counts, windowFor, timers,
    fire() { const next = timers.entries().next().value; assert.ok(next); timers.delete(next[0]); next[1](); },
    close() { for (const driver of drivers) driver.stop(); assert.equal(timers.size, 0); } };
}

test('five unread sessions become four only after one actual active visible result-tail read', async () => {
  const f = fixture();
  try {
    const seqs = ['a','b','c','d','e'].map(id => f.finish(id));
    const w = f.windowFor('c', 1, seqs[2], { intersecting: false });
    w.driver.refresh(); await tick(); assert.equal(f.controller.snapshot().pendingCount, 5);
    w.setView({ intersecting: true }); await tick();
    assert.equal(f.controller.snapshot().pendingCount, 4);
    assert.deepEqual(f.counts, [1,2,3,4,5,4]);
    assert.deepEqual(w.calls.map(call => call.endpoint), ['pending','read']);
    w.driver.refresh(); await tick(); assert.equal(w.calls.length, 2);
  } finally { f.close(); }
});

test('foreground A never acknowledges B; switching actual rendered view reads only B', async () => {
  const f = fixture();
  try {
    const a = f.finish('a'); const w = f.windowFor('a', 1, a);
    w.driver.refresh(); await tick(); assert.equal(f.controller.snapshot().pendingCount, 0);
    const b = f.finish('b'); await tick(); assert.equal(f.controller.snapshot().pendingCount, 1);
    w.setView({ sessionId: 'b', eventSeq: b, intersecting: false }); await tick();
    assert.equal(f.controller.snapshot().pendingCount, 1);
    w.setView({ intersecting: true }); await tick(); assert.equal(f.controller.snapshot().pendingCount, 0);
  } finally { f.close(); }
});

for (const [field, value] of [['active',false],['visible',false],['focused',false],['intersecting',false],['eventSeq',undefined],['turn',undefined]]) {
  test(`read proof requires ${field}; a session-open event alone is insufficient`, async () => {
    const f = fixture();
    try {
      const seq = f.finish('a'); const w = f.windowFor('a',1,seq,{ [field]: value });
      w.driver.refresh(); await tick(); assert.equal(f.controller.snapshot().pendingCount,1); assert.equal(w.calls.length,0);
    } finally { f.close(); }
  });
}

test('viewing an old turn never clears a newer terminal result', async () => {
  const f = fixture();
  try {
    const old = f.finish('a'); const latest = f.finish('a',2);
    const w = f.windowFor('a',1,old); w.driver.refresh(); await tick();
    assert.deepEqual(w.calls.map(call => call.endpoint),['pending']); assert.equal(f.controller.snapshot().pendingCount,1);
    w.setView({turn:2,eventSeq:latest}); await tick(); assert.equal(f.controller.snapshot().pendingCount,0);
  } finally { f.close(); }
});

test('same turn but assistant-message seq is not the turn/end seq and cannot acknowledge', async () => {
  const f = fixture();
  try {
    const latest=f.finish('a'); const w=f.windowFor('a',1,latest-1);
    w.driver.refresh(); await tick(); assert.equal(f.controller.snapshot().pendingCount,1);
    assert.deepEqual(w.calls.map(call=>call.endpoint),['pending']);
  } finally { f.close(); }
});

for (const change of ['hide','blur','switch','disconnect','generation','stop']) {
  test(`in-flight snapshot cannot acknowledge after ${change}`, async () => {
    const f=fixture();
    try {
      const seq=f.finish('a'); const w=f.windowFor('a',1,seq);
      let release;
      w.call=async (...args)=>{
        const result=await w.channelCall(...args);
        if (args[1]==='pending') await new Promise(resolve=>{release=()=>resolve(result);});
        return result;
      };
      w.driver.refresh(); await tick();
      if(change==='hide') w.setView({visible:false});
      if(change==='blur') w.setView({focused:false});
      if(change==='switch') w.setView({active:false});
      if(change==='disconnect') w.reconnect(undefined);
      if(change==='generation') { w.reconnect({id:2}); w.setView({active:false}); }
      if(change==='stop') w.driver.stop();
      release(); await tick();
      assert.equal(w.calls.filter(call=>call.endpoint==='read').length,0);
      assert.equal(f.controller.snapshot().pendingCount,1);
    } finally { f.close(); }
  });
}

test('a new result between pending and read rejects the old revision and retries only a new rendered proof', async () => {
  const f=fixture();
  try {
    const seq=f.finish('a'); const w=f.windowFor('a',1,seq); let newer;
    w.call=async (...args)=>{
      if(args[1]==='read') newer=f.finish('a',2);
      return w.channelCall(...args);
    };
    w.driver.refresh(); await tick(); assert.equal(f.controller.snapshot().pendingCount,1);
    assert.equal(f.controller.pendingFor('a').turn,2);
    w.call=null; w.setView({turn:2,eventSeq:newer}); await tick();
    assert.equal(f.controller.snapshot().pendingCount,0);
  } finally { f.close(); }
});

test('ACK before a newer event cannot suppress its fresh unread revision', async () => {
  const f=fixture();
  try {
    const seq=f.finish('a'); const w=f.windowFor('a',1,seq); w.driver.refresh(); await tick();
    assert.equal(f.controller.snapshot().pendingCount,0);
    f.finish('a',2); w.driver.refresh(); await tick(); assert.equal(f.controller.snapshot().pendingCount,1);
  } finally { f.close(); }
});

test('two visible windows acknowledge one session once and never clear another session', async () => {
  const f=fixture();
  try {
    const seq=f.finish('a'); f.finish('b');
    const first=f.windowFor('a',1,seq), second=f.windowFor('a',1,seq);
    first.driver.refresh(); second.driver.refresh(); await tick();
    assert.equal(f.controller.snapshot().pendingCount,1); assert.ok(f.controller.pendingFor('b'));
    assert.deepEqual(f.counts,[1,2,1]);
  } finally { f.close(); }
});

test('visibility hide/show, disconnect/reconnect and page remount do not clear host pending', async () => {
  const f=fixture();
  try {
    const seq=f.finish('a'); const old=f.windowFor('a',1,seq,{visible:false});
    old.driver.refresh(); old.reconnect(undefined); old.driver.stop(); await tick();
    assert.equal(f.controller.snapshot().pendingCount,1);
    const fresh=f.windowFor('a',1,seq,{visible:false}); fresh.driver.refresh(); await tick();
    fresh.reconnect({id:2}); fresh.setView({visible:true,intersecting:false}); await tick();
    assert.equal(f.controller.snapshot().pendingCount,1);
    fresh.setView({intersecting:true}); await tick(); assert.equal(f.controller.snapshot().pendingCount,0);
  } finally { f.close(); }
});

test('late delivery/reconnect failures retry without optimistic decrement; stop cancels timers', async () => {
  const f=fixture();
  try {
    const seq=f.finish('a'); const w=f.windowFor('a',1,seq); let fails=true;
    w.call=async (...args)=>{ if(fails) throw new Error('network offline'); return w.channelCall(...args); };
    w.driver.refresh(); await tick(); assert.equal(f.controller.snapshot().pendingCount,1); assert.equal(f.timers.size,1);
    fails=false; f.fire(); await tick(); assert.equal(f.controller.snapshot().pendingCount,0);
  } finally { f.close(); }
});

test('owner gate, malformed requests, disposed Host and aborted requests are rejected', () => {
  const f=fixture();
  try {
    const seq=f.finish('a'); const pending=f.controller.pendingFor('a');
    const request={...pending,eventSeq:seq};
    for(const [endpoint,payload,peer] of [
      ['pending',{sessionId:'a'},null], ['read',request,{principal:{kind:'guest'}}],
      ['pending',{sessionId:''},owner], ['pending',[],owner], ['unknown',{sessionId:'a'},owner],
      ['read',{...request,revision:1},owner], ['read',{...request,eventSeq:-1},owner],
      ['read',{...request,kind:'waiting'},owner],
    ]) assert.equal(f.bridge(endpoint,payload,undefined,peer).ok,false);
    const aborted=AbortSignal.abort(); assert.equal(f.bridge('read',request,aborted,owner).ok,false);
    assert.equal(createBridge(f.controller,()=>true)('read',request,undefined,owner).ok,false);
    assert.equal(f.controller.snapshot().pendingCount,1);
  } finally { f.close(); }
});
