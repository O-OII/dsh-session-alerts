/** Optional full official SDK oracle checks; no Agent activation or native helper. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCompletionDefinition } from '../completion-state.mjs';
import { apply as applyCompletion, inject } from '../completion.mjs';
assert.ok(process.env.DSH_BADGE_SDK_ROOT, 'Set DSH_BADGE_SDK_ROOT to an extracted official node_modules closure.');
const sdk=process.env.DSH_BADGE_SDK_ROOT;
const agentPath=resolve(sdk,'@deepseek-ai/dsh-agent/lib/index.js');
const {foldConsumedWork}=await import(pathToFileURL(agentPath).href);
const {goalProjectionDefinition}=await import(pathToFileURL(resolve(sdk,'@deepseek-ai/dsh-goal/lib/index.js')).href);
const definition=createCompletionDefinition(goalProjectionDefinition);
function log(){const events=[];return{events,add(type,data={}){const event={type,data,seq:events.length};events.push(event);return event;}};}
function replay(events,header={},cut=0){return events.reduce(definition.apply,definition.init(header,cut));}
function assertOracle(events,cut=0){const actual=replay(events,{},cut),expected=foldConsumedWork(events.filter(event=>event.seq>=cut));assert.equal(actual.accounting?.seq,expected.end?.seq);assert.equal(actual.droppedUnrun,expected.droppedUnrun);}
const goalSnapshot=(operation,phase,revision)=>({kind:'goal/change',version:1,operation,goal:{id:'g',revision,objective:'fixture objective',phase,maxGoalRounds:3},roundsStarted:0,createdAt:1,updatedAt:revision});
test('projection accounting matches the actual exported foldConsumedWork oracle over valid varied histories',()=>{
  const f=log();assertOracle(f.events);let seed=17;
  for(let turn=1;turn<=80;turn++){
    seed=(seed*48271)%2147483647;const choice=seed%6;
    f.add('turn/start',{turn});assertOracle(f.events);
    if(choice!==0)f.add('agent/inbox/spliced',{removedCount:1,inserted:[],outcome:'claimed'});
    if(choice>=2)f.add('step/start',{turn,step:1});
    f.add('turn/end',{turn,reason:{kind:['completed','completed','error','blocked','aborted','completed'][choice]}});assertOracle(f.events);
    if(choice===5){f.add('agent/inbox/spliced',{removedCount:1,outcome:'canceled',inserted:[]});assertOracle(f.events);}
  }
});
test('strict actual goal replay: clear does not launder active end, invalid goal keeps wire stale but our state unknown',()=>{
  const f=log();f.add('goal/change',goalSnapshot('create','active',1));f.add('turn/start',{turn:1});f.add('step/start',{turn:1,step:1});f.add('turn/end',{turn:1,reason:{kind:'completed'}});
  f.add('goal/change',{kind:'goal/change',version:1,operation:'clear',cleared:{id:'g',revision:2},clearedAt:2});
  const cleared=replay(f.events);assert.equal(cleared.goal.failure,null);assert.equal(cleared.goal.current,null);assert.equal(cleared.view.state,'incomplete');assert.equal(cleared.view.goalPhaseAtEnd,'active');
  const g=log();g.add('goal/change',goalSnapshot('create','active',1));g.add('turn/start',{turn:1});g.add('step/start',{turn:1,step:1});g.add('goal/change',goalSnapshot('complete','complete',2));g.add('turn/end',{turn:1,reason:{kind:'completed'}});
  assert.equal(replay(g.events).view.state,'completed');
  g.add('goal/change',goalSnapshot('complete','complete',99));const invalid=replay(g.events);assert.equal(invalid.goal.current.goal.phase,'complete');assert.notEqual(invalid.goal.failure,null);assert.equal(invalid.view.state,'unknown');
});
test('fork suffix matches real oracle while complete inherited goal history remains strict',()=>{
  const f=log();f.add('goal/change',goalSnapshot('create','active',1));f.add('turn/start',{turn:1});f.add('step/start',{turn:1,step:1});f.add('turn/end',{turn:1,reason:{kind:'completed'}});
  const cut=f.events.length;f.add('turn/start',{turn:2});f.add('step/start',{turn:2,step:1});f.add('turn/end',{turn:2,reason:{kind:'completed'}});
  assertOracle(f.events,cut);const state=replay(f.events,{parentSession:'ordinary-fork'},cut);assert.equal(state.view.main,true);assert.equal(state.view.state,'incomplete');assert.equal(state.view.goalPhaseAtEnd,'active');
  const checkpoint=definition.stateSchema.parse(JSON.parse(JSON.stringify(state)));assert.equal(checkpoint.ownFrom,cut);
});
test('independent actual completion Host entry registers with only sessionProjections, without Python/native services',async()=>{
  assert.deepEqual(inject,['sessionProjections']);const original=process.argv[1];let registered;
  try{process.argv[1]=agentPath;await applyCompletion(new Proxy({sessionProjections:{register(value){registered=value;}}},{get(target,key){if(key!=='sessionProjections')throw new Error(`Unexpected dependency ${String(key)}`);return target[key];}}));}
  finally{process.argv[1]=original;}
  assert.equal(registered.key,'sessionAlertsCompletion');assert.equal(registered.wire.view(registered.init()).state,'incomplete');
  const sidecar = await import('../sidebar-package/index.mjs');
  assert.deepEqual(sidecar.inject,['sessionProjections']);
  try { process.argv[1]=agentPath; await sidecar.apply({sessionProjections:{register(value){registered=value;}}}); }
  finally { process.argv[1]=original; }
  assert.equal(registered.key,'sessionAlertsCompletion');
});
