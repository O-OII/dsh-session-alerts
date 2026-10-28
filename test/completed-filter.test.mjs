import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompletedFilter, descendantActivity } from '../completed-filter.mjs';
import { createCompletionReader } from '../completion-reader.mjs';
import { COMPLETION_KEY } from '../completion-contract.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function source(value){const listeners=new Set();return{getSnapshot:()=>value,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},set(next){value=next;for(const fn of listeners)fn();},listeners};}
function summary(id,extra={}){return{id,updatedAt:1,running:false,blank:false,...extra};}
function wire(state='completed',extra={}){return{version:1,state,main:true,turn:1,eventSeq:2,goalPhaseAtEnd:'none',goalIdAtEnd:null,droppedUnrun:false,...extra};}
function fixture(rows=[summary('a')],states={a:'completed'},options={}){
  const sessions=source({ids:rows.map(row=>row.id),byId:Object.fromEntries(rows.map(row=>[row.id,row]))});
  const statuses=source(new Map()),generation=source({id:1}),calls=[],timers=new Map();let timerId=0;
  const fixture={sessions,statuses,generation,calls,timers,states,handler:null};
  const model=createCompletedFilter({sessions,statuses,generation,now:()=>1000,
    classify:async(ids,signal)=>{calls.push([...ids]);if(fixture.handler)return fixture.handler(ids,signal);return{ok:true,value:{sessions:ids.map(sessionId=>({sessionId,state:states[sessionId]??'unknown'}))}};},
    schedule(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},cancel(id){timers.delete(id);},...options});
  return{...fixture,model,get snapshot(){return model.source.getSnapshot();},setRows(rows){sessions.set({ids:rows.map(row=>row.id),byId:Object.fromEntries(rows.map(row=>[row.id,row]))});},
    setHandler(fn){fixture.handler=fn;},close(){model.dispose();assert.equal(timers.size,0);assert.equal(sessions.listeners.size,0);assert.equal(statuses.listeners.size,0);assert.equal(generation.listeners.size,0);}};
}
test('toggle is page-local, disabled by default, and does not read or mutate Session stores',async()=>{
  const f=fixture();try{await tick();assert.equal(f.calls.length,0);assert.equal(f.snapshot.enabled,false);
    f.model.setEnabled(true);await tick();assert.deepEqual([...f.snapshot.matchingSessionIds],['a']);
    f.model.setEnabled(false);assert.equal(f.snapshot.enabled,false);assert.equal(f.snapshot.matchingSessionIds.size,0);
    assert.equal(f.sessions.getSnapshot().byId.a.updatedAt,1);
  }finally{f.close();}
});
test('only Host-authoritative completed main sessions match; other endings do not',async()=>{
  const rows=['done','running','waiting','error','incomplete','unknown'].map(id=>summary(id));
  const f=fixture(rows,Object.fromEntries(rows.map(row=>[row.id,row.id==='done'?'completed':row.id])));
  try{f.model.setEnabled(true);await tick();assert.deepEqual([...f.snapshot.matchingSessionIds],['done']);assert.deepEqual([...f.snapshot.unknownSessionIds],['unknown']);}finally{f.close();}
});
test('already-read completion remains included; unread flags do not define completion',async()=>{
  const f=fixture();try{f.model.setEnabled(true);await tick();f.statuses.set(new Map([['a',{running:false,completionUnread:false}]]));await tick();assert.equal(f.snapshot.matchingSessionIds.has('a'),true);}finally{f.close();}
});
test('running and pending UI authority immediately remove an old matching completion',async()=>{
  const f=fixture();try{f.model.setEnabled(true);await tick();
    f.statuses.set(new Map([['a',{running:true}]]));assert.equal(f.snapshot.matchingSessionIds.size,0);
    f.statuses.set(new Map([['a',{running:false,pendingInteraction:{key:'approval'}}]]));assert.equal(f.snapshot.matchingSessionIds.size,0);
  }finally{f.close();}
});
test('ordinary fork parentSessionId is preserved; subagent origin is not accepted',async()=>{
  const f=fixture([summary('fork',{parentSessionId:'source',depth:2}),summary('child',{origin:'subagent',parentSessionId:'fork'})],{fork:'completed',child:'completed'});
  try{f.model.setEnabled(true);await tick();assert.deepEqual([...f.snapshot.matchingSessionIds],['fork']);assert.deepEqual(f.calls,[['fork']]);}finally{f.close();}
});
test('known running descendants exclude their real main parent, not another ordinary fork ancestor',async()=>{
  const rows=[summary('source'),summary('fork',{parentSessionId:'source'}),summary('child',{origin:'subagent',parentSessionId:'fork',running:true})];
  const f=fixture(rows,{source:'completed',fork:'completed'});try{f.model.setEnabled(true);await tick();assert.deepEqual([...f.snapshot.matchingSessionIds],['source']);}finally{f.close();}
});
test('nested runtime-running subagent and broken/cyclic ancestry fail closed without infinite scan',()=>{
  const byId=Object.fromEntries([summary('a'),summary('c1',{origin:'subagent',parentSessionId:'a'}),summary('c2',{origin:'subagent',parentSessionId:'c1'})].map(row=>[row.id,row]));
  assert.equal(descendantActivity(byId,new Map([['c2',{running:true}]])).running.has('a'),true);
  byId.c1.parentSessionId='c2';assert.equal(descendantActivity(byId,new Map([['c2',{running:true}]])).unresolvedRunningIds.has('c2'),true);
  delete byId.c1;assert.equal(descendantActivity(byId,new Map([['c2',{running:true}]])).unresolvedRunningIds.has('c2'),true);
});
test('real ClientSessions parentId DTO takes precedence and nested retained children veto only their main',async()=>{
  const f=fixture([summary('source'),summary('fork',{parentId:'source'}),
    summary('c1',{origin:'subagent',parentId:'fork'}),
    summary('c2',{origin:'subagent',parentId:'c1',parentSessionId:'source',running:true})],{source:'completed',fork:'completed'});
  try{f.model.setEnabled(true);await tick();assert.deepEqual([...f.snapshot.matchingSessionIds],['source']);assert.equal(f.snapshot.matchingSessionIds.has('fork'),false);}finally{f.close();}
});
test('real parentId cyclic and missing ancestry uses the same normalized key without unrelated pollution',()=>{
  const byId=Object.fromEntries([summary('main'),summary('c1',{origin:'subagent',parentId:'c2'}),summary('c2',{origin:'subagent',parentId:'c1',running:true})].map(row=>[row.id,row]));
  let result=descendantActivity(byId,new Map());assert.equal(result.running.size,0);assert.equal(result.unresolvedRunningIds.has('c2'),true);
  byId.c1.parentId='main';result=descendantActivity(byId,new Map());assert.equal(result.running.has('main'),true);assert.equal(result.unresolvedRunningIds.size,0);
  delete byId.c1;result=descendantActivity(byId,new Map());assert.equal(result.running.size,0);assert.equal(result.unresolvedRunningIds.has('c2'),true);
});
test('orphan running-child ancestry does not pollute unrelated authoritative main completions',async()=>{
  const f=fixture([summary('a'),summary('child',{origin:'subagent',running:true})]);
  try{f.model.setEnabled(true);await tick();assert.equal(f.snapshot.matchingSessionIds.has('a'),true);assert.equal(f.snapshot.unknownSessionIds.has('a'),false);assert.deepEqual(f.calls,[['a']]);}finally{f.close();}
});
test('known cold baselines are cached; unrelated list/retention changes do not reread logs',async()=>{
  const f=fixture();try{f.model.setEnabled(true);await tick();assert.equal(f.calls.length,1);assert.equal(f.timers.size,0);
    f.setRows([summary('a',{retainedBy:{mainView:1}})]);await tick();assert.equal(f.calls.length,1);
    f.setRows([summary('a',{updatedAt:2})]);await tick();assert.equal(f.calls.length,2);
  }finally{f.close();}
});
test('disabled filter stops requests/timers; explicit re-enable refreshes only by user action',async()=>{
  const f=fixture();try{f.model.setEnabled(true);await tick();f.model.setEnabled(false);f.setRows([summary('a',{updatedAt:9})]);await tick();assert.equal(f.calls.length,1);
    f.model.setEnabled(true);await tick();assert.equal(f.calls.length,2);
  }finally{f.close();}
});
test('retrying an unchanged unknown baseline publishes pending until its authority responds',async()=>{
  const f=fixture([summary('a')],{a:'unknown'});let release;
  try{f.model.setEnabled(true);await tick();assert.equal(f.snapshot.unknownSessionIds.has('a'),true);
    assert.equal(f.timers.size,1);
    f.setHandler(async()=>new Promise(resolve=>{release=()=>resolve({ok:true,value:{sessions:[{sessionId:'a',state:'completed'}]}});}));
    const retry=f.model.refresh();assert.equal(f.snapshot.pendingSessionIds.has('a'),true);
    assert.equal(f.snapshot.unknownSessionIds.has('a'),false);assert.equal(f.timers.size,0);
    release();await retry;assert.deepEqual([...f.snapshot.matchingSessionIds],['a']);
    assert.equal(f.snapshot.pendingSessionIds.size,0);assert.equal(f.snapshot.unknownSessionIds.size,0);
  }finally{f.close();}
});
test('explicit retry queued during a later batch preserves force for an earlier unknown result',async()=>{
  const f=fixture([summary('a'),summary('b')],{a:'unknown',b:'completed'},{batchSize:1});let release;
  f.setHandler(async(ids)=>{
    if(ids[0]==='b'&&f.calls.length===2)return new Promise(resolve=>{release=()=>resolve({ok:true,value:{sessions:[{sessionId:'b',state:'completed'}]}});});
    return {ok:true,value:{sessions:ids.map(sessionId=>({sessionId,state:f.states[sessionId]}))}};
  });
  try{f.model.setEnabled(true);await tick();assert.deepEqual(f.calls,[['a'],['b']]);
    assert.equal(f.snapshot.unknownSessionIds.has('a'),true);assert.equal(f.snapshot.pendingSessionIds.has('b'),true);
    f.states.a='completed';void f.model.refresh();release();await tick();
    assert.deepEqual(f.calls,[['a'],['b'],['a'],['b']]);
    assert.deepEqual([...f.snapshot.matchingSessionIds],['a','b']);assert.equal(f.timers.size,0);
  }finally{f.close();}
});
test('disable and re-enable during an aborted later batch revalidates earlier cached results',async()=>{
  const f=fixture([summary('a'),summary('b')],{a:'completed',b:'completed'},{batchSize:1});let release,oldSignal;
  f.setHandler(async(ids,signal)=>{
    if(ids[0]==='b'&&f.calls.length===2){oldSignal=signal;return new Promise(resolve=>{release=()=>resolve({ok:true,value:{sessions:[{sessionId:'b',state:'completed'}]}});});}
    return {ok:true,value:{sessions:ids.map(sessionId=>({sessionId,state:f.states[sessionId]}))}};
  });
  try{f.model.setEnabled(true);await tick();assert.equal(f.snapshot.matchingSessionIds.has('a'),true);
    f.model.setEnabled(false);assert.equal(oldSignal.aborted,true);f.states.a='error';f.model.setEnabled(true);
    // Ordinary invalidation while queued must not downgrade the explicit force.
    f.setRows([summary('a'),summary('b',{updatedAt:2})]);release();await tick();
    assert.deepEqual(f.calls,[['a'],['b'],['a'],['b']]);assert.deepEqual([...f.snapshot.matchingSessionIds],['b']);
  }finally{f.close();}
});
test('disconnect/reconnect invalidates the previous generation and unknown transport data is excluded',async()=>{
  const f=fixture();try{f.model.setEnabled(true);await tick();f.generation.set(undefined);assert.equal(f.snapshot.matchingSessionIds.size,0);
    f.states.a='unknown';f.generation.set({id:2});await tick();assert.equal(f.snapshot.matchingSessionIds.size,0);assert.equal(f.snapshot.unknownSessionIds.has('a'),true);
    assert.equal([...f.timers.values()][0].delay,30000);
  }finally{f.close();}
});
test('in-flight stale response after new running catalog update cannot restore completion',async()=>{
  const f=fixture();let release;
  f.setHandler(async(ids,signal)=>new Promise(resolve=>{release=()=>resolve({ok:true,value:{sessions:ids.map(sessionId=>({sessionId,state:'completed'}))}});}));
  try{f.model.setEnabled(true);await tick();assert.equal(f.snapshot.pendingSessionIds.has('a'),true);
    f.setRows([summary('a',{running:true,updatedAt:2})]);release();await tick();assert.equal(f.snapshot.matchingSessionIds.size,0);
  }finally{f.close();}
});
test('completion source is immutable and composes by set intersection without rewriting other filters',async()=>{
  const f=fixture([summary('a'),summary('b')],{a:'completed',b:'completed'});try{const before=f.snapshot;f.model.setEnabled(true);await tick();assert.equal(before.matchingSessionIds.size,0);
    const searchMatches=new Set(['b','c']),archiveMatches=new Set(['a','b']);
    assert.deepEqual([...f.snapshot.matchingSessionIds].filter(id=>searchMatches.has(id)&&archiveMatches.has(id)),['b']);
    f.model.setEnabled(false);assert.deepEqual([...searchMatches],['b','c']);assert.deepEqual([...archiveMatches],['a','b']);
  }finally{f.close();}
});

test('reader uses exact official projections signature, no retain, and at most four concurrent reads',async()=>{
  let active=0,max=0;const calls=[];
  const remote={session:{async projections(request,signal){assert.equal(typeof request.sessionId,'string');assert.ok(signal);calls.push(request);active++;max=Math.max(max,active);await tick();active--;return{ok:true,value:{kind:'sequenced',asOfSeq:3,values:{[COMPLETION_KEY]:wire()}}};}}};
  const reader=createCompletionReader(remote);const result=await reader(['a','b','c','d','e','a'],new AbortController().signal);
  assert.equal(max,4);assert.equal(calls.length,5);assert.equal(result.value.sessions.length,5);assert.ok(result.value.sessions.every(row=>row.state==='completed'));
});
test('reader excludes migration/missing/malformed/stale-cut/strict-goal-unknown and pending questions',async()=>{
  const values={missing:null,migration:{kind:'migration-required',values:{[COMPLETION_KEY]:wire()}},bad:{kind:'sequenced',asOfSeq:3,values:{[COMPLETION_KEY]:{}}},
    future:{kind:'sequenced',asOfSeq:1,values:{[COMPLETION_KEY]:wire()}},unknown:{kind:'sequenced',asOfSeq:3,values:{[COMPLETION_KEY]:wire('unknown')}},
    waiting:{kind:'sequenced',asOfSeq:3,values:{[COMPLETION_KEY]:wire(),userQuestions:{active:[{callId:'q',state:'continued'}]}}}};
  const reader=createCompletionReader({session:{async projections({sessionId}){return{ok:true,value:values[sessionId]};}}});
  const result=await reader(Object.keys(values),new AbortController().signal);
  assert.deepEqual(result.value.sessions.map(row=>row.state),['unknown','unknown','unknown','unknown','unknown','waiting']);
});
test('reader cancellation prevents queued cold reads',async()=>{
  const controller=new AbortController();let calls=0;
  const reader=createCompletionReader({session:{async projections(){calls++;controller.abort();return{ok:true,value:null};}}});
  await assert.rejects(reader(['a','b','c','d','e','f'],controller.signal));assert.ok(calls<=4);
});
