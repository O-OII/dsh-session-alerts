import test from 'node:test';
import assert from 'node:assert/strict';
import {createUnreadFilter} from '../unread-filter.mjs';
function source(value){const listeners=new Set();return{getSnapshot:()=>value,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},set(next){value=next;for(const fn of listeners)fn();},listeners};}
const rows=ids=>({ids,byId:Object.fromEntries(ids.map(id=>[id,{id}]))});
function fixture(){const sessions=source(rows(['unread','read','running','waiting','failed','unknown']));const statuses=source(new Map([
 ['unread',{completionUnread:true,running:false}],['read',{completionUnread:false,running:false}],
 ['running',{completionUnread:true,running:true}],['waiting',{pendingInteraction:{kind:'question'}}],
 ['failed',{completionUnread:true}],['unknown',{}],
]));const model=createUnreadFilter({sessions,statuses});return{sessions,statuses,model,get snapshot(){return model.source.getSnapshot();},close(){model.dispose();assert.equal(sessions.listeners.size,0);assert.equal(statuses.listeners.size,0);}};}
test('unread is disabled by default; completion alone and pending interaction never imply unread',()=>{
 const f=fixture();try{assert.equal(f.snapshot.enabled,false);assert.equal(f.snapshot.matchingSessionIds.size,0);f.model.setEnabled(true);assert.deepEqual([...f.snapshot.matchingSessionIds],['unread','running','failed']);assert.equal(f.snapshot.pendingSessionIds.size,0);assert.equal(f.snapshot.unknownSessionIds.size,0);}finally{f.close();}
});
test('read and new-unread status changes update an active filter synchronously',()=>{
 const f=fixture();try{f.model.setEnabled(true);const before=f.snapshot;f.statuses.set(new Map([['read',{completionUnread:true}],['unread',{completionUnread:false}]]));assert.deepEqual([...f.snapshot.matchingSessionIds],['read']);assert.deepEqual([...before.matchingSessionIds],['unread','running','failed']);}finally{f.close();}
});
test('reset restores all acceptance without clearing native unread state',()=>{
 const f=fixture();try{const native=f.statuses.getSnapshot();f.model.setEnabled(true);f.model.setEnabled(false);assert.equal(f.snapshot.enabled,false);assert.equal(f.snapshot.matchingSessionIds.size,0);assert.equal(f.statuses.getSnapshot(),native);f.model.setEnabled(true);assert.equal(f.snapshot.matchingSessionIds.has('unread'),true);}finally{f.close();}
});
test('completed historical sessions, missing statuses and truthy non-boolean flags stay excluded',()=>{
 const f=fixture();try{f.statuses.set(new Map([['read',{completionUnread:1}],['unread',{completionUnread:'true'}]]));const list=f.sessions.getSnapshot();list.byId.unknown.projectionValues={sessionAlertsCompletion:{state:'completed'}};f.model.setEnabled(true);assert.equal(f.snapshot.matchingSessionIds.size,0);}finally{f.close();}
});
test('removed catalog sessions disappear; new sessions inherit only their real status bit',()=>{
 const f=fixture();try{f.model.setEnabled(true);f.statuses.set(new Map([['later',{completionUnread:true}],['unread',{completionUnread:true}]]));f.sessions.set(rows(['later']));assert.deepEqual([...f.snapshot.matchingSessionIds],['later']);}finally{f.close();}
});
test('subagents are excluded but ordinary forks are not mistaken for children',()=>{
 const f=fixture();try{f.sessions.set({ids:['main','fork','child','deep'],byId:{main:{id:'main'},fork:{id:'fork',parentId:'main'},child:{id:'child',origin:'subagent'},deep:{id:'deep',delegationDepth:1}}});f.statuses.set(new Map(['main','fork','child','deep'].map(id=>[id,{completionUnread:true}])));f.model.setEnabled(true);assert.deepEqual([...f.snapshot.matchingSessionIds],['main','fork']);}finally{f.close();}
});
test('unchanged matching sets retain snapshot identity; disposal stops all notifications',()=>{
 const f=fixture();f.model.setEnabled(true);let changes=0;f.model.source.subscribe(()=>changes++);const before=f.snapshot;f.statuses.set(new Map(f.statuses.getSnapshot()));assert.equal(f.snapshot,before);assert.equal(changes,0);f.close();f.model.setEnabled(false);assert.equal(f.snapshot,before);assert.equal(changes,0);
});
test('pending interaction and a running descendant do not veto a real native unread flag',()=>{
 const f=fixture();try{f.sessions.set({ids:['parent'],byId:{parent:{id:'parent'},child:{id:'child',origin:'subagent',parentId:'parent',running:true}}});f.statuses.set(new Map([['parent',{completionUnread:true,pendingInteraction:{kind:'approval'}}],['child',{running:true}]]));f.model.setEnabled(true);assert.deepEqual([...f.snapshot.matchingSessionIds],['parent']);}finally{f.close();}
});
test('empty unread filter remains enabled so new unread arrivals become visible without toggling',()=>{
 const f=fixture();try{f.statuses.set(new Map());f.model.setEnabled(true);assert.equal(f.snapshot.enabled,true);assert.equal(f.snapshot.matchingSessionIds.size,0);f.statuses.set(new Map([['read',{completionUnread:true}]]));assert.deepEqual([...f.snapshot.matchingSessionIds],['read']);}finally{f.close();}
});
