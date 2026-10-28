import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
function source(value){const listeners=new Set();return{getSnapshot:()=>value,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},set(next){value=next;for(const fn of listeners)fn();},listeners};}
function fixture({apiVersion=1,unread=true,language='zh'}={}){
 const entries=new Map(),filters=new Map(),effects=[],dictionaries=new Map(),calls=[];let factory;
 const sessions=source({ids:['a','read'],byId:{a:{id:'a'},read:{id:'read',projectionValues:{sessionAlertsCompletion:{state:'completed'}}}}});
 const statuses=source(new Map([['a',{completionUnread:unread}],['read',{completionUnread:false}]]));
 const ctx={sessions:{list:sessions},uiSession:{sessionStatus:statuses},
  remote:{session:{projections(){calls.push('projections');throw Error('Unread filter must not classify completions');}}},
  logger:{warn(){}},locale:{register(ns,messages){dictionaries.set(ns,messages);return()=>dictionaries.delete(ns);}},
  uiWorkspace:{sessionFilters:{apiVersion,register(definition){filters.set(definition.id,definition);return()=>filters.delete(definition.id);}}},
  effect(fn){const dispose=fn();let active=true;const cleanup=()=>{if(active){active=false;dispose?.();}};effects.push(cleanup);return cleanup;},
  slots:{inject(name,fn){fn();return()=>{for(const [key,value]of entries)if(value.spec.name===name)entries.delete(key);};},register(spec,component){const key=spec.name+':'+spec.id;entries.set(key,{spec,component});return()=>entries.delete(key);}}};
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}})};
 vm.runInNewContext(readFileSync(new URL('../sidebar-client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load(value){assert.equal(value.id,'dsh-session-alerts-sidebar');factory=value.factory;}}}});
 const plugin=factory(name=>{assert.equal(name,'react');return React;});assert.equal(entries.size,0);plugin.apply(ctx);
 function render(name,props={}){const entry=[...entries.values()].find(value=>value.spec.name===name);assert.ok(entry,name);const injected=entry.spec.inject?.()??{};const messages=dictionaries.get(entry.spec.locale)[language];const t=key=>messages[key];return entry.component({...injected,...props,t,useUnreadFilter:select=>select(injected.hooks.unreadFilter.getSnapshot())});}
 return{ctx,entries,filters,effects,calls,sessions,statuses,render,close(){for(const dispose of effects.reverse())dispose();}};
}
function text(node){if(node==null)return'';if(typeof node==='string')return node;return(node.props?.children??[]).map(text).join(' ');}
function buttons(node){if(!node||typeof node!=='object')return[];return[node.type==='button'?node:null,...(node.props?.children??[]).flatMap(buttons)].filter(Boolean);}
test('standalone registers unread-only native seams without completion requests or read markers',()=>{
 const f=fixture();try{assert.equal(f.filters.size,1);assert.equal(f.entries.size,2);assert.equal([...f.filters.keys()][0],'dsh-native-taskbar-badge.unread');assert.equal([...f.filters.values()][0].source.getSnapshot().enabled,false);assert.equal(f.calls.length,0);assert.ok([...f.entries.values()].every(entry=>['sidebar.workspaces.header.action','sidebar.workspaces.filter.status'].includes(entry.spec.name)));assert.doesNotMatch(readFileSync(new URL('../sidebar-client.js',import.meta.url),'utf8'),/conversation\.chat\.turnTail|native\.py|subprocess\.spawn|createCompletionReader|createCompletedFilter|remote\.session\.projections/);}finally{f.close();}assert.equal(f.filters.size,0);assert.equal(f.entries.size,0);assert.equal(f.sessions.listeners.size,0);assert.equal(f.statuses.listeners.size,0);
});
for(const language of ['zh','en'])test(`accessible ${language} bell reversibly filters unread, not read completions`,()=>{
 const f=fixture({language});try{let b=f.render('sidebar.workspaces.header.action');assert.equal(b.type,'button');assert.equal(b.props.type,'button');assert.equal(b.props['aria-pressed'],false);assert.equal(b.props.style.width,28);b.props.onClick();b=f.render('sidebar.workspaces.header.action');assert.equal(b.props['aria-pressed'],true);const state=[...f.filters.values()][0].source.getSnapshot();assert.equal(state.matchingSessionIds.has('a'),true);assert.equal(state.matchingSessionIds.has('read'),false);b.props.onClick();assert.equal([...f.filters.values()][0].source.getSnapshot().enabled,false);assert.equal(f.calls.length,0);}finally{f.close();}
});
test('exact requested title and accessible label change from 未读过滤 to 重置条件; bell is unchanged',()=>{
 const f=fixture();try{let b=f.render('sidebar.workspaces.header.action');assert.equal(b.props.title,'未读过滤');assert.equal(b.props['aria-label'],'未读过滤');const[svg]=b.props.children;assert.equal(svg.props.width,16);assert.equal(svg.props.height,16);assert.equal(svg.props.strokeWidth,1);assert.match(svg.props.children[0].props.d,/M6\.5 13/);b.props.onClick();b=f.render('sidebar.workspaces.header.action');assert.equal(b.props.title,'重置条件');assert.equal(b.props['aria-label'],'重置条件');assert.equal(b.props['aria-pressed'],true);}finally{f.close();}
});
test('empty state explains no unread and reset only removes unread condition',()=>{
 const f=fixture({unread:false});const search='hello',archive='show';try{f.render('sidebar.workspaces.header.action').props.onClick();const status=f.render('sidebar.workspaces.filter.status',{active:true,visibleCount:0});assert.equal(status.props.role,'status');assert.equal(status.props['aria-live'],'polite');assert.match(text(status),/没有未读会话/);assert.doesNotMatch(text(status),/已完成|判定/);assert.equal(buttons(status).length,1);assert.equal(text(buttons(status)[0]),'重置条件');buttons(status)[0].props.onClick();assert.equal([...f.filters.values()][0].source.getSnapshot().enabled,false);assert.equal(search,'hello');assert.equal(archive,'show');assert.equal(f.calls.length,0);}finally{f.close();}
});
test('live read removes row and new unread appears without another click',()=>{
 const f=fixture();try{f.render('sidebar.workspaces.header.action').props.onClick();const source=[...f.filters.values()][0].source;f.statuses.set(new Map([['a',{completionUnread:false}]]));assert.equal(source.getSnapshot().matchingSessionIds.size,0);f.statuses.set(new Map([['read',{completionUnread:true}]]));assert.equal(source.getSnapshot().matchingSessionIds.has('read'),true);assert.equal(source.getSnapshot().enabled,true);}finally{f.close();}
});
test('missing workspace API gives unavailable status rather than a fake bell',()=>{
 const f=fixture({apiVersion:0});try{assert.equal(f.filters.size,0);assert.ok(![...f.entries.values()].some(entry=>entry.spec.name==='sidebar.workspaces.header.action'));const status=f.render('sidebar.workspaces.filter.status',{active:false,visibleCount:0});assert.match(text(status),/未读过滤不可用/);}finally{f.close();}
});
test('shared unread source builds identical standalone factory in local sidecar package',()=>{
 assert.equal(readFileSync(new URL('../sidebar-client.js',import.meta.url),'utf8'),readFileSync(new URL('../sidebar-package/client.js',import.meta.url),'utf8'));const pkg=JSON.parse(readFileSync(new URL('../sidebar-package/package.json',import.meta.url),'utf8'));assert.equal(pkg.name,'dsh-session-alerts-sidebar');assert.doesNotMatch(readFileSync(new URL('../sidebar-package/index.mjs',import.meta.url),'utf8'),/spawn\(|pythonPath|createController/);
});
