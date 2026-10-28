import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { COMPLETION_KEY } from '../completion-contract.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function source(value){const listeners=new Set();return{getSnapshot:()=>value,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},listeners};}
function fixture({apiVersion=1,state='completed',language='zh'}={}){
  const entries=new Map(),filters=new Map(),effects=[],dictionaries=new Map(),calls=[];let factory;
  const sessions=source({ids:['a'],byId:{a:{id:'a',updatedAt:1,running:false,blank:false}}});
  const statuses=source(new Map()),generation=source({id:1});
  const ctx={sessions:{list:sessions},uiSession:{sessionStatus:statuses},connection:{generation},
    remote:{session:{async projections(request,signal){calls.push(request);assert.ok(signal);return{ok:true,value:{kind:'sequenced',asOfSeq:3,values:{[COMPLETION_KEY]:{version:1,state,main:true,turn:1,eventSeq:2,goalPhaseAtEnd:'none',goalIdAtEnd:null,droppedUnrun:false}}}};}}},
    logger:{warn(){}},locale:{register(ns,messages){dictionaries.set(ns,messages);return()=>dictionaries.delete(ns);}},
    uiWorkspace:{sessionFilters:{apiVersion,register(definition){filters.set(definition.id,definition);return()=>filters.delete(definition.id);}}},
    effect(fn){const dispose=fn();let active=true;const cleanup=()=>{if(active){active=false;dispose?.();}};effects.push(cleanup);return cleanup;},
    slots:{inject(name,fn){fn();return()=>{for(const [key,value]of entries)if(value.spec.name===name)entries.delete(key);};},
      register(spec,component){const key=spec.name+':'+spec.id;entries.set(key,{spec,component});return()=>entries.delete(key);}}};
  const React={createElement:(type,props,...children)=>({type,props:{...props,children}})};
  vm.runInNewContext(readFileSync(new URL('../sidebar-client.js',import.meta.url),'utf8'),{
    window:{__ModuleLoader__:{load(value){assert.equal(value.id,'dsh-session-alerts-sidebar');factory=value.factory;}}},
    AbortController,setTimeout,clearTimeout,console,
  });
  const plugin=factory(name=>{assert.equal(name,'react');return React;});
  assert.equal(entries.size,0);
  assert.ok(Array.from(plugin.inject).includes('remote.session'), 'official session Remote namespace must be explicitly injected');
  plugin.apply(ctx);
  function render(name,props={}){
    const entry=[...entries.values()].find(value=>value.spec.name===name);assert.ok(entry,name);
    const injected=entry.spec.inject?.()??{};
    const messages=dictionaries.get(entry.spec.locale)[language];
    const t=(key,values={})=>messages[key].replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
    return entry.component({...injected,...props,t,
      useCompletedFilter:select=>select(injected.hooks.completedFilter.getSnapshot())});
  }
  return{ctx,entries,filters,effects,calls,sessions,statuses,generation,render,dictionaries,
    close(){for(const dispose of effects.reverse())dispose();}};
}
function text(node){if(node===null||node===undefined)return'';if(typeof node==='string')return node;return(node.props?.children??[]).map(text).join(' ');}
function buttons(node){if(!node||typeof node!=='object')return[];return[node.type==='button'?node:null,...(node.props?.children??[]).flatMap(buttons)].filter(Boolean);}

test('standalone lazy client registers only native header/status seams, not the old unread marker',async()=>{
  const f=fixture();try{
    assert.equal(f.filters.size,1);assert.equal(f.entries.size,2);
    assert.equal([...f.filters.values()][0].source.getSnapshot().enabled,false);
    assert.equal(f.calls.length,0);
    assert.ok([...f.entries.values()].every(entry=>['sidebar.workspaces.header.action','sidebar.workspaces.filter.status'].includes(entry.spec.name)));
    const standalone=readFileSync(new URL('../sidebar-client.js',import.meta.url),'utf8');assert.doesNotMatch(standalone,/conversation\.chat\.turnTail|native\.py|subprocess\.spawn/);
  }finally{f.close();}
  assert.equal(f.filters.size,0);assert.equal(f.entries.size,0);assert.equal(f.sessions.listeners.size,0);assert.equal(f.generation.listeners.size,0);
});
for(const language of ['zh','en'])test(`accessible ${language} header toggle exposes real pressed state and reversibly filters`,async()=>{
  const f=fixture({language});try{
    let button=f.render('sidebar.workspaces.header.action',{searchExpanded:false});
    assert.equal(button.type,'button');assert.equal(button.props.type,'button');assert.equal(button.props['aria-pressed'],false);
    assert.ok(button.props['aria-label']);assert.ok(button.props.title);assert.equal(button.props.style.width,28);
    button.props.onClick();await tick();
    button=f.render('sidebar.workspaces.header.action',{wide:true});assert.equal(button.props['aria-pressed'],true);
    assert.deepEqual([...f.filters.values()][0].source.getSnapshot().matchingSessionIds.has('a'),true);
    button.props.onClick();assert.equal([...f.filters.values()][0].source.getSnapshot().enabled,false);
  }finally{f.close();}
});
test('empty status clearly recovers only this filter and preserves search/archive/other sources',async()=>{
  const f=fixture({state:'error'});let otherEnabled=true,query='hello',archive='show';
  try{f.render('sidebar.workspaces.header.action',{wide:true}).props.onClick();await tick();
    const status=f.render('sidebar.workspaces.filter.status',{active:true,visibleCount:0,pendingCount:0,unknownCount:0});
    assert.equal(status.props.role,'status');assert.equal(status.props['aria-live'],'polite');assert.match(text(status),/暂无.*已完成主会话/);
    buttons(status)[0].props.onClick();assert.equal([...f.filters.values()][0].source.getSnapshot().enabled,false);
    assert.equal(otherEnabled,true);assert.equal(query,'hello');assert.equal(archive,'show');
  }finally{f.close();}
});
test('pending and unknown status are visible and explicit recheck uses only projection reads',async()=>{
  const f=fixture({state:'unknown'});try{
    f.render('sidebar.workspaces.header.action',{wide:false}).props.onClick();await tick();
    const pending=f.render('sidebar.workspaces.filter.status',{active:true,visibleCount:0,pendingCount:2,unknownCount:0});assert.match(text(pending),/正在判定 2/);
    const unknown=f.render('sidebar.workspaces.filter.status',{active:true,visibleCount:0,pendingCount:0,unknownCount:1});assert.match(text(unknown),/1.*可靠完成状态/);
    assert.equal(buttons(unknown).length,2);buttons(unknown)[1].props.onClick();await tick();assert.equal(f.calls.length,2);
  }finally{f.close();}
});
test('missing workspace API provides unavailable status and no fake header button',()=>{
  const f=fixture({apiVersion:0});try{
    assert.equal(f.filters.size,0);assert.ok(![...f.entries.values()].some(entry=>entry.spec.name==='sidebar.workspaces.header.action'));
    const status=f.render('sidebar.workspaces.filter.status',{active:false,visibleCount:0});assert.match(text(status),/筛选不可用/);assert.equal(buttons(status).length,0);
  }finally{f.close();}
});
test('shared sidebar source builds identical standalone factory in optional local sidecar package',()=>{
  assert.equal(readFileSync(new URL('../sidebar-client.js',import.meta.url),'utf8'),readFileSync(new URL('../sidebar-package/client.js',import.meta.url),'utf8'));
  const pkg=JSON.parse(readFileSync(new URL('../sidebar-package/package.json',import.meta.url),'utf8'));
  assert.equal(pkg.name,'dsh-session-alerts-sidebar');assert.equal(pkg.version,'0.3.0');
  assert.doesNotMatch(readFileSync(new URL('../sidebar-package/index.mjs',import.meta.url),'utf8'),/spawn\(|pythonPath|createController/);
});
