import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnreadFilter} from '../../../unread-filter.mjs';
import {captureBrowser,fixtureData,loadModule,source} from './fixture.mjs';
function setup(search=false){const data=fixtureData();data.statuses=new Map([['s2',{completionUnread:true}],['s8',{completionUnread:true}],['s3',{completionUnread:true}],['s5',{completionUnread:false}]]);data.list.byId.s5.projectionValues={sessionAlertsCompletion:{state:'completed'}};const sdk=loadModule(false,search?{stateOverrides:['Topic',true]}:{}).module;const browser=captureBrowser(sdk,data);const statuses=source(data.statuses);const model=createUnreadFilter({sessions:browser.ctx.sessions.list,statuses});const remove=browser.ctx.uiWorkspace.sessionFilters.register({id:'real-unread',source:model.source});return{data,browser,model,setStatus(next){data.statuses=next;statuses.set(next);},close(){remove();model.dispose();assert.equal(statuses.listenerCount(),0);}};}
const count=result=>result.slotCalls.find(c=>c.name==='sidebar.workspaces.filter.status')?.props.visibleCount;
test('actual native workspace/tree/flat rows follow live unread flags and preserve archive visibility',()=>{
 const f=setup();try{f.model.setEnabled(true);for(const groupBy of ['workspace','workspace-tree','flat']){const r=f.browser.render({groupBy});assert.equal(count(r),2);assert.match(r.html,/Topic 2</);assert.match(r.html,/Topic 8</);assert.doesNotMatch(r.html,/Topic 5</);assert.doesNotMatch(r.html,/Topic 3</);}
 f.setStatus(new Map([['s8',{completionUnread:true}],['s10',{completionUnread:true}]]));for(const groupBy of ['workspace','workspace-tree','flat']){const r=f.browser.render({groupBy});assert.equal(count(r),2);assert.doesNotMatch(r.html,/Topic 2</);assert.match(r.html,/Topic 8</);assert.match(r.html,/Topic 10</);}
 f.setStatus(new Map());for(const groupBy of ['workspace','workspace-tree','flat']){const r=f.browser.render({groupBy});assert.equal(count(r),0);assert.match(r.html,/filter.noMatches/);}
 f.model.setEnabled(false);const reset=f.browser.render();assert.equal(count(reset),undefined);assert.match(reset.html,/Topic 1</);assert.equal(f.data.list.byId.s1.retainedBy.mainView,1);
 }finally{f.close();}
});
test('actual native nonempty search intersects unread instead of completed and resets without clearing query',()=>{
 const f=setup();
 // This fixture renders SSR, so hook state is reconstructed on each render.
 // Load a fresh search adapter each time instead of exhausting stateOverrides.
 const renderSearch=()=>{const b=captureBrowser(loadModule(false,{stateOverrides:['Topic',true]}).module,f.data);const stop=b.ctx.uiWorkspace.sessionFilters.register({id:'unread-search',source:f.model.source});try{return b.render();}finally{stop();}};
 try{f.model.setEnabled(true);let r=renderSearch();assert.equal(count(r),2);assert.match(r.html,/value="Topic"/);assert.match(r.html,/Topic 2</);assert.doesNotMatch(r.html,/Topic 5</);f.setStatus(new Map());r=renderSearch();assert.equal(count(r),0);assert.match(r.html,/value="Topic"/);f.model.setEnabled(false);r=renderSearch();assert.equal(count(r),undefined);assert.match(r.html,/value="Topic"/);assert.match(r.html,/Topic 5</);}finally{f.close();}
});
