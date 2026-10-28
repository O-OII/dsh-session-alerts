import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createController } from '../controller.mjs';
import { createBridge } from '../bridge.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function source(value) {
  const listeners=new Set();
  return { getSnapshot:()=>value, subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    set(next){value=next;for(const fn of listeners)fn();}, listeners };
}
function target(initial={}) {
  const events=new Map();
  return {...initial,events,addEventListener(name,fn){if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},
    removeEventListener(name,fn){events.get(name)?.delete(fn);},emit(name){for(const fn of events.get(name)??[])fn();}};
}
function fixture({observer=true}={}) {
  const controller=createController(), bridge=createBridge(controller), calls=[];
  const session={id:'main',header:{delegationDepth:0}};
  controller.sessionEvent(session,{type:'turn/start',seq:1,data:{turn:1}});
  controller.sessionEvent(session,{type:'turn/end',seq:42,data:{turn:1,reason:{kind:'completed'}}});
  const chat=source({timeline:{turns:new Map([[1,{end:{seq:42}}]])}});
  const current=source({key:'main'}), generation=source({id:1});
  const window=target({innerHeight:800,innerWidth:1200});
  let focused=true;
  const document=target({visibilityState:'visible',hasFocus:()=>focused});
  const node={isConnected:true,checkVisibility:()=>true,getBoundingClientRect:()=>({top:100,bottom:101,left:100,right:101,width:1,height:1})};
  const effects=[],observers=[]; let definition;
  const ctx={connection:{generation,rpc:{async call(channel,endpoint,payload,signal){calls.push({channel,endpoint,payload});return bridge(endpoint,payload,signal,{principal:{kind:'owner'}});}}},
    effect(fn){effects.push(fn());},locale:{register(){return()=>{};}},uiWorkspace:{},
    uiSession:{current},sessions:{binding:id=>id==='main'?{sessionId:id}:undefined},
    uiConversation:{binding:()=>({target:id=>{assert.equal(id,'chat');return chat;}})},
    slots:{inject(name,callback){if(name==='conversation.chat.turnTail')callback();},register(spec,component){definition={spec,component};}}};
  const React={useRef:()=>({current:node}),useEffect:fn=>{effects.push(fn());},createElement:(type,props)=>({type,props})};
  let factory;
  window.__ModuleLoader__={load(value){assert.equal(value.id,'dsh-native-taskbar-badge');factory=value.factory;}};
  const context={window,document,AbortController,setTimeout,clearTimeout,
    IntersectionObserver:observer?class {constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}observe(value){assert.equal(value,node);}disconnect(){this.disconnected=true;}}:undefined};
  vm.runInNewContext(readFileSync(new URL('../client.js',import.meta.url),'utf8'),context);
  assert.equal(definition,undefined); // Loading only registers a lazy factory.
  const plugin=factory(name=>{assert.equal(name,'react');return React;}); plugin.apply(ctx);
  const injected=definition.spec.inject('main');
  const output=definition.component({sessionId:'main',turn:1,seq:7,useBadgeChat:select=>select(injected.hooks.badgeChat.getSnapshot())});
  return {controller,calls,ctx,current,generation,node,document,window,output,observers,
    focus(value){focused=value;window.emit(value?'focus':'blur');},
    intersect(value){observers[0].callback([{target:node,isIntersecting:value,intersectionRatio:value?1:0}]);},
    close(){for(const dispose of effects)dispose?.();}};
}

test('packaged official loader contribution reads timeline turn/end seq, never tail message seq',async()=>{
  const f=fixture();
  try{
    assert.equal(f.output.type,'span');assert.equal(f.output.props['aria-hidden'],true);
    await tick(); assert.equal(f.controller.snapshot().pendingCount,1);
    f.intersect(true);await tick();assert.equal(f.controller.snapshot().pendingCount,0);
    assert.deepEqual(f.calls.map(c=>c.endpoint),['pending','read']);assert.equal(f.calls[1].payload.eventSeq,42);
    assert.equal(f.calls[1].payload.turn,1);
  }finally{f.close();}
  assert.equal(f.observers[0].disconnected,true); assert.equal(f.current.listeners.size,0);assert.equal(f.generation.listeners.size,0);
  for(const events of [f.document.events,f.window.events])for(const listeners of events.values())assert.equal(listeners.size,0);
});
test('missing IntersectionObserver fails closed, without session-open fallback',async()=>{
  const f=fixture({observer:false});try{await tick();assert.equal(f.calls.length,0);assert.equal(f.controller.snapshot().pendingCount,1);}finally{f.close();}
});
test('actual main binding, page visibility, focus and own marker geometry all gate read',async()=>{
  const f=fixture();
  try{
    f.current.set({key:'other'});f.intersect(true);await tick();assert.equal(f.calls.length,0);
    f.document.visibilityState='hidden';f.current.set({key:'main'});await tick();assert.equal(f.calls.length,0);
    f.focus(false);f.document.visibilityState='visible';f.document.emit('visibilitychange');await tick();assert.equal(f.calls.length,0);
    f.node.getBoundingClientRect=()=>({top:900,bottom:901,left:100,right:101,width:1,height:1});f.focus(true);await tick();assert.equal(f.calls.length,0);
    f.node.getBoundingClientRect=()=>({top:100,bottom:101,left:100,right:101,width:1,height:1});f.intersect(true);await tick();assert.equal(f.controller.snapshot().pendingCount,0);
  }finally{f.close();}
});
