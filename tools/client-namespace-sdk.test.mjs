/** Complete real Cordis + ClientRemoteService + generated ApiRemotes assembly.
 * Only the underlying transport/type-registry storage is fake. No live request.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCompletionReader } from '../completion-reader.mjs';
import { COMPLETION_KEY } from '../completion-contract.mjs';
assert.ok(process.env.DSH_BADGE_SDK_ROOT, 'Set DSH_BADGE_SDK_ROOT to the official extracted dependency closure');
const sdk=process.env.DSH_BADGE_SDK_ROOT;
const {Context}=await import(pathToFileURL(resolve(sdk,'@deepseek-ai/cordis/lib/index.js')).href);
const gateway=await import(pathToFileURL(resolve(sdk,'@deepseek-ai/dsh-api-gateway/lib/client.node.js')).href);
const zod=await import(pathToFileURL(resolve(sdk,'zod/index.js')).href);
let apiFactory;
vm.runInNewContext(readFileSync(resolve(sdk,'@deepseek-ai/dsh-api-remotes/lib/client.js'),'utf8'),{
  window:{__ModuleLoader__:{load(value){apiFactory=value.factory;}}},AbortController,AbortSignal,TextEncoder,Uint8Array,
});
const api=apiFactory(name=>{assert.equal(name,'zod');return zod;});
function clientDeclaration(filename){let factory;vm.runInNewContext(readFileSync(new URL(filename,import.meta.url),'utf8'),{window:{__ModuleLoader__:{load(row){factory=row.factory;}}}});return factory(name=>{assert.equal(name,'react');return{};}).inject;}
async function fixture(){
  const root=new Context(),calls=[];
  const foundation=root.plugin({name:'namespace-test-foundation',apply(ctx){
    ctx.provide('connection',{interactions:'none',isLoopback:true,generation:{getSnapshot:()=>undefined},rpc:{open(){},async call(channel,endpoint,payload,signal){calls.push({channel,endpoint,payload,signal});return{ok:true,value:{kind:'sequenced',asOfSeq:5,values:{[COMPLETION_KEY]:{version:1,state:'completed',main:true,turn:1,eventSeq:4,goalPhaseAtEnd:'none',goalIdAtEnd:null,droppedUnrun:false}}}};}}});
    ctx.provide('typert',{remotes:{register(){return()=>{};}}});
    for(const name of ['slots','sessions','uiSession','uiConversation','locale','uiWorkspace'])ctx.provide(name,{});
  }});await foundation.await();
  const remote=root.plugin({name:'actual-client-gateway',inject:gateway.inject,apply:gateway.apply});await remote.await();
  const assembly=root.plugin({name:'actual-api-remotes',inject:api.inject,apply:api.apply});await assembly.await();
  return{root,calls,async close(){await assembly.dispose();await remote.dispose();await foundation.dispose();}};
}
test('actual traced ApiRemotes namespace rejects remote.session when only remote was injected',async()=>{
  const f=await fixture();const old=f.root.plugin({name:'old-missing-namespace',inject:['remote'],apply(ctx){void ctx.remote.session;}});
  try{await assert.rejects(old.await(),/cannot get property "remote\.session" without inject/);assert.equal(f.calls.length,0);}
  finally{await old.dispose();await f.close();}
});
for(const [label,file] of [['standalone','../sidebar-client.js'],['full client','../client.js']])test(`${label} actual declaration and production reader traverse real namespace and preserve custom wire value`,async()=>{
  const f=await fixture();const inject=Array.from(clientDeclaration(file));assert.ok(inject.includes('remote.session'));
  let operation;
  const consumer=f.root.plugin({name:'fixed-'+label,inject,apply(ctx){operation=createCompletionReader(ctx.remote)(['a'],new AbortController().signal);}});
  try{await consumer.await();assert.ok(operation);const result=await operation;assert.equal(result.value.sessions[0].state,'completed');
    assert.equal(f.calls.length,1);assert.equal(f.calls[0].channel,'/api');assert.equal(f.calls[0].endpoint,'session/projections');assert.equal(f.calls[0].payload.args.request.sessionId,'a');
  }finally{await consumer.dispose();await f.close();}
});
