import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompletionDefinition } from '../completion-state.mjs';
// Minimal strict domain fixture for portable tests. The separate SDK suite uses
// the complete official goalProjectionDefinition and foldConsumedWork export.
const goal = {
  init: () => ({ current: null, failure: null }), stateSchema: { parse: value => value },
  apply(state, event) {
    if (state.failure || event.type !== 'goal/change') return state;
    if (event.data.operation === 'clear') return { current: null, failure: null };
    if (!event.data.goal?.id || !['active','paused','blocked','complete'].includes(event.data.goal.phase)) return { ...state, failure: 'invalid goal' };
    return { current: { goal: event.data.goal }, failure: null };
  },
};
function fixture(header={}, inherited=0, domain=goal) {
  const definition=createCompletionDefinition(domain);let state=definition.init(header,inherited),seq=0;
  const send=(type,data={},override)=>{const event={type,data,seq:override??seq++};state=definition.apply(state,event);return event;};
  return {send,definition,get state(){return state;},get view(){return definition.wire.view(state);},
    start(turn=1){send('turn/start',{turn});},step(turn=1){send('step/start',{turn});},
    end(kind='completed',turn=1){send('turn/end',{turn,reason:{kind}});},
    goal(phase,id='g'){send('goal/change',{operation:phase==='clear'?'clear':'update',goal:{id,phase}});},
    claim(outcome,inserted=[]){send('agent/inbox/spliced',{removedCount:1,outcome,inserted});}};
}
test('real stepped main work completed is included independently of unread/exposure',()=>{
  const f=fixture();f.start();f.step();f.end();assert.equal(f.view.state,'completed');
  const before=f.state;f.send('irrelevant/read',{read:true});assert.equal(f.state,before);
  assert.equal(f.view.main,true);assert.equal(f.view.turn,1);assert.equal(f.view.eventSeq,2);
});
test('idle/new/empty first claim/no-op completed never invents work success',()=>{
  for(const claimed of [false,true]){const f=fixture();assert.equal(f.view.state,'incomplete');f.start();if(claimed)f.claim();f.end();assert.equal(f.view.state,'incomplete');assert.equal(f.view.eventSeq,null);}
});
test('no-op completed does not wash a prior accounting failure into success',()=>{
  const f=fixture();f.start();f.step();f.end('error');f.start(2);f.claim();f.end('completed',2);assert.equal(f.view.state,'error');assert.equal(f.view.turn,1);
});
test('prior successful consumed work survives a balanced empty no-op',()=>{
  const f=fixture();f.start();f.step();f.end();f.start(2);f.end('completed',2);assert.equal(f.view.state,'completed');assert.equal(f.view.turn,1);
});
for(const reason of ['error','blocked','max-tokens','aborted','interrupted','forked'])test(`accounting ${reason} is not completed`,()=>{
  const f=fixture();f.start();f.step();f.end(reason);assert.notEqual(f.view.state,'completed');
});
test('claimed pre-step blocked/error/aborted accounts for failure without a step',()=>{
  for(const reason of ['blocked','error','aborted']){const f=fixture();f.start();f.claim();f.end(reason);assert.notEqual(f.view.state,'completed');assert.equal(f.view.turn,1);assert.notEqual(f.view.eventSeq,null);}
});
test('dropped unrun cancellation invalidates old success; no-op cannot reset it',()=>{
  const f=fixture();f.start();f.step();f.end();f.claim('canceled');assert.equal(f.view.state,'incomplete');assert.equal(f.view.droppedUnrun,true);
  f.start(2);f.end('completed',2);assert.equal(f.view.state,'incomplete');
  f.start(3);f.step(3);f.end('completed',3);assert.equal(f.view.state,'completed');assert.equal(f.view.droppedUnrun,false);
});
test('removedCount absent and canceled replacement with inserted work follow SDK semantics',()=>{
  const f=fixture();f.start();f.step();f.end();f.send('agent/inbox/spliced',{outcome:'canceled',inserted:[]});assert.equal(f.view.state,'completed');
  f.claim('canceled',[{}]);assert.equal(f.view.state,'completed');
});
test('new running work immediately removes an old completion; approval is waiting',()=>{
  const f=fixture();f.start();f.step();f.end();f.start(2);assert.equal(f.view.state,'running');
  f.send('approval/asked',{id:'a'});assert.equal(f.view.state,'waiting');f.send('approval/decided',{id:'a'});assert.equal(f.view.state,'running');
});
test('intermediate active-goal completion remains excluded after clear',()=>{
  const f=fixture();f.goal('active');f.start();f.step();f.end();assert.equal(f.view.state,'incomplete');
  f.goal('clear');assert.equal(f.view.state,'incomplete');assert.equal(f.view.goalPhaseAtEnd,'active');assert.equal(f.view.goalIdAtEnd,'g');
});
for(const phase of ['active','paused','blocked'])test(`${phase} goal at accounting end is not successful`,()=>{
  const f=fixture();f.goal(phase);f.start();f.step();f.end();f.goal('clear');assert.equal(f.view.state,'incomplete');
});
test('goal complete at accounting end is allowed; later complete alone is conservatively not enough',()=>{
  const good=fixture();good.goal('active');good.start();good.step();good.goal('complete');good.end();assert.equal(good.view.state,'completed');
  const late=fixture();late.goal('active');late.start();late.step();late.end();late.goal('complete');assert.equal(late.view.state,'incomplete');
});
test('strict-goal failure is unknown even when prior visible goal was complete',()=>{
  const f=fixture();f.goal('complete');f.start();f.step();f.end();assert.equal(f.view.state,'completed');
  f.send('goal/change',{operation:'update',goal:{phase:'garbled'}});assert.equal(f.view.state,'unknown');
});
test('ordinary fork parent ID is not subagent, but inherited work does not count',()=>{
  const f=fixture({parentSession:'source',isSeeded:true},3);f.start();f.step();f.end();assert.equal(f.view.state,'incomplete');
  f.start(2);f.step(2);f.end('completed',2);assert.equal(f.view.state,'completed');assert.equal(f.state.ownFrom,3);
});
test('goal folds full inherited history while work accounting folds only owned suffix',()=>{
  const f=fixture({},4);f.goal('active');f.start();f.step();f.end();f.start(2);f.step(2);f.end('completed',2);
  assert.equal(f.view.state,'incomplete');assert.equal(f.view.goalPhaseAtEnd,'active');
});
test('origin/delegation subagents are excluded',()=>{
  for(const header of [{origin:'subagent'},{delegationDepth:1}]){const f=fixture(header);f.start();f.step();f.end();assert.equal(f.view.main,false);assert.notEqual(f.view.state,'completed');}
});
test('recovered tool/assistant-attempt errors are not permanently disqualifying',()=>{
  const f=fixture();f.start();f.step();f.send('tool/result',{error:'recovered'});f.send('assistant/attempt',{error:'retry'});f.end();assert.equal(f.view.state,'completed');
});
test('checkpoint retains inherited cut, accounting-goal evidence and serializable state',()=>{
  const f=fixture({},2);f.send('noop');f.send('noop');f.goal('active');f.start();f.step();f.end();
  const copy=f.definition.stateSchema.parse(JSON.parse(JSON.stringify(f.state)));
  assert.equal(copy.ownFrom,2);assert.equal(copy.accounting.goalPhase,'active');assert.equal(copy.view.state,'incomplete');
  assert.throws(()=>f.definition.stateSchema.parse({...copy,ownFrom:-1}),/checkpoint/);
  assert.throws(()=>f.definition.wire.viewSchema.parse({}),/projection/);
});
