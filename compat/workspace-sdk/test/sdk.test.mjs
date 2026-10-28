import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { loadModule, source, filterValue, fixtureData, captureBrowser, plain, root } from './fixture.mjs';
const { module: sdk, definition, code } = loadModule();
const native = sdk.workspaceSessionFilterDerivations;
const original = loadModule(true).module.workspaceSessionFilterDerivations;
function registry(ids, pending = [], unknown = []) {
  const value = new sdk.SessionFiltersRegistry();
  const input = source(filterValue(ids, true, pending, unknown));
  const stop = value.register({ id: 'test', source: input });
  return { value, input, stop, snapshot: () => value.getSnapshot() };
}

test('original module identity, dependency graph, exports and host noop remain intact', () => {
  const base = JSON.parse(fs.readFileSync(path.join(root, 'vendor/ui-workspace/package.json')));
  const result = JSON.parse(fs.readFileSync(path.join(root, 'dist/ui-workspace/package.json')));
  assert.equal(definition.id, base.name);
  assert.equal(result.private, true);
  for (const key of ['name', 'version', 'main', 'exports', 'dsh', 'peerDependencies', 'devDependencies']) assert.deepEqual(result[key], base[key]);
  assert.equal(fs.readFileSync(path.join(root, 'dist/ui-workspace/lib/index.js'), 'utf8'), fs.readFileSync(path.join(root, 'vendor/ui-workspace/lib/index.js'), 'utf8'));
  const audit = JSON.parse(fs.readFileSync(path.join(root, 'dist/ui-workspace/AUDIT.json')));
  assert.equal(crypto.createHash('sha256').update(code).digest('hex'), audit.clientSha256);
  assert.equal(audit.edits.length, 45);
  let rebuilt = fs.readFileSync(path.join(root, 'vendor/ui-workspace/lib/client.js'), 'utf8');
  for (const edit of audit.edits) {
    assert.equal(rebuilt.split(edit.before).length - 1, edit.count);
    rebuilt = rebuilt.split(edit.before).join(edit.after);
  }
  assert.equal(rebuilt, code, 'generated bundle contains only recorded exact edits');
});

test('builder rejects unpinned official input before touching the distribution', () => {
  const input = path.join(root, 'artifacts/input-rejection');
  fs.mkdirSync(path.join(input, 'lib'), { recursive: true });
  const target = path.join(input, 'lib/client.js');
  if (fs.existsSync(target)) fs.readFileSync(target);
  fs.writeFileSync(target, fs.readFileSync(path.join(root, 'vendor/ui-workspace/lib/client.js'), 'utf8') + '\n// intentionally invalid input for rejection test\n');
  const before = fs.readFileSync(path.join(root, 'dist/ui-workspace/lib/client.js'));
  const child = spawnSync(process.execPath, [path.join(root, 'scripts/build.mjs'), input], { stdio: 'ignore' });
  assert.ifError(child.error);
  assert.equal(child.status, 1);
  assert.deepEqual(fs.readFileSync(path.join(root, 'dist/ui-workspace/lib/client.js')), before);
});

test('registry duplicate rejection, stable snapshot identity, immutable snapshots and copied sets', () => {
  const reg = registry(['s1', 's2']);
  assert.equal(reg.value.apiVersion, 1);
  const snapshot = reg.snapshot();
  assert.equal(reg.snapshot(), snapshot);
  assert.equal(Object.isFrozen(snapshot), true);
  reg.input.emit();
  assert.equal(reg.snapshot(), snapshot, 'same immutable source snapshot is a no-op');
  reg.input.getSnapshot().matchingSessionIds.clear();
  assert.equal(snapshot.matches('s1'), true, 'published matches closed over copied sets');
  assert.throws(() => reg.value.register({ id: 'test', source: reg.input }), /duplicate/);
  assert.equal(reg.input.listenerCount(), 1);
  reg.input.set(filterValue(['s2']));
  assert.notEqual(reg.snapshot(), snapshot);
  assert.equal(snapshot.matches('s1'), true, 'old aggregate remains immutable');
  assert.equal(reg.snapshot().matches('s1'), false);
});

test('AND composition, disabled contributions, deduplicated pending/unknown and not-matched semantics', () => {
  const reg = registry(['s1', 's2', 's3'], ['s2'], ['s3']);
  const second = source(filterValue(['s1', 's2', 's3', 's4'], true, ['s2'], ['s3', 's4']));
  const stopSecond = reg.value.register({ id: 'second', source: second });
  assert.equal(reg.snapshot().matches('s1'), true);
  for (const id of ['s2', 's3', 's4', 'missing']) assert.equal(reg.snapshot().matches(id), false);
  assert.equal(reg.snapshot().pendingCount, 1);
  assert.equal(reg.snapshot().unknownCount, 2);
  second.set(filterValue(['s2']));
  assert.equal(reg.snapshot().matches('s1'), false);
  second.set(filterValue([], false, ['unused'], ['unused']));
  assert.equal(reg.snapshot().matches('s1'), true);
  assert.equal(reg.snapshot().unknownCount, 1);
  const stableWithDisabled = reg.snapshot();
  second.set(filterValue(['ignored'], false));
  assert.equal(reg.snapshot(), stableWithDisabled, 'disabled source change cannot disturb enabled aggregate identity');
  stopSecond();
  assert.equal(reg.snapshot(), stableWithDisabled);
  assert.equal(second.listenerCount(), 0);
});

test('source subscription race closes; invalid source rolls registration back', () => {
  const reg = new sdk.SessionFiltersRegistry();
  let current = filterValue(['before']);
  let listeners = 0;
  const stop = reg.register({ id: 'race', source: { getSnapshot: () => current, subscribe: () => { listeners++; current = filterValue(['after']); return () => listeners--; } } });
  assert.equal(reg.getSnapshot().matches('after'), true);
  assert.equal(reg.getSnapshot().matches('before'), false);
  stop(); assert.equal(listeners, 0);
  assert.throws(() => reg.register({ id: 'bad', source: { getSnapshot: () => filterValue([]), subscribe() { throw new Error('subscribe failed'); } } }), /subscribe failed/);
  const retry = reg.register({ id: 'bad', source: source(filterValue([], false)) });
  retry();
  assert.throws(() => reg.register({ id: '', source: source(filterValue([])) }), /non-empty/);
  assert.throws(() => reg.register({ id: 'invalid', source: source({ enabled: true }) }), /expected/);
});

test('reset, unsubscribe, disposal and unload restore original no-filter object identity', () => {
  const reg = new sdk.SessionFiltersRegistry();
  const inactive = reg.getSnapshot();
  const rows = [{ id: 's1' }, { id: 's2' }];
  assert.equal(sdk.filterSessions(rows, inactive), rows);
  let updates = 0;
  const unsubscribe = reg.subscribe(() => updates++);
  const input = source(filterValue(['s2']));
  const stop = reg.register({ id: 'owned', source: input });
  assert.deepEqual(plain(sdk.filterSessions(rows, reg.getSnapshot())), [{ id: 's2' }]);
  input.set(filterValue([], false));
  assert.equal(reg.getSnapshot(), inactive);
  assert.equal(sdk.filterSessions(rows, reg.getSnapshot()), rows);
  input.set(filterValue(['s1']));
  stop(); stop();
  assert.equal(input.listenerCount(), 0);
  assert.equal(reg.getSnapshot(), inactive);
  assert.equal(sdk.filterSessions(rows, reg.getSnapshot()), rows);
  unsubscribe(); const before = updates;
  const stopAgain = reg.register({ id: 'owned', source: input });
  reg.dispose(); reg.dispose(); stopAgain();
  assert.equal(input.listenerCount(), 0);
  assert.equal(updates, before);
  assert.equal(reg.getSnapshot(), inactive);
  assert.throws(() => reg.register({ id: 'late', source: input }), /disposed/);
});

test('no-filter native grouped, flat, search and all archive modes exactly equal upstream', () => {
  const data = fixtureData();
  const { list, workspaces, statuses, view } = data;
  const inactive = new sdk.SessionFiltersRegistry().getSnapshot();
  for (const archivedFilter of ['default', 'show', 'only']) {
    const state = { ...data.rowState, archivedFilter };
    assert.deepEqual(plain(native.deriveGroups(list, workspaces, state, statuses, view, inactive)), plain(original.deriveGroups(list, workspaces, state, statuses, view)));
    assert.deepEqual(plain(native.deriveFlat(list, list.ids, state, statuses, inactive)), plain(original.deriveFlat(list, list.ids, state, statuses)));
    const args = [list, workspaces, 'Topic', state.archivedSessionIds, archivedFilter, statuses, { items: [], hasMore: false }, 20];
    assert.deepEqual(plain(native.deriveSearchResults(...args, inactive)), plain(original.deriveSearchResults(...args)));
  }
  assert.deepEqual(plain(native.sessionMemberIds(list)), plain(original.sessionMemberIds(list)));
});

test('native filtering precedes watermark, includes 8th+ matches, preserves pins/order/archive and full membership', () => {
  const data = fixtureData();
  const before = JSON.stringify(data.list);
  const fullOrder = [...data.list.ids];
  const filtered = registry(['s2', 's3', 's7', 's8', 's9', 's10', 's11', 's12']);
  const groups = native.deriveGroups(data.list, data.workspaces, data.rowState, data.statuses, data.view, filtered.snapshot());
  assert.deepEqual(plain(groups[0].sessions.map(row => row.id)), ['s2', 's7', 's8']);
  assert.deepEqual(plain(native.watermarkRows(groups[0].sessions, 5).rows.map(row => row.id)), ['s2', 's7', 's8']);
  const flat = native.deriveFlat(data.list, fullOrder, data.rowState, data.statuses, filtered.snapshot());
  assert.deepEqual(plain(flat.map(row => row.id)), ['s2', 's9', 's7', 's8', 's10', 's11', 's12']);
  assert.equal(JSON.stringify(data.list), before);
  assert.deepEqual(fullOrder, data.list.ids);
  assert.equal(native.sessionMemberIds(data.list).includes('s3'), true, 'hidden archive stays in membership');
  const all = native.deriveFlat(data.list, fullOrder, { ...data.rowState, archivedFilter: 'show' }, data.statuses, filtered.snapshot());
  assert.equal(all.some(row => row.id === 's3' && row.archived), true);
  const only = native.deriveFlat(data.list, fullOrder, { ...data.rowState, archivedFilter: 'only' }, data.statuses, filtered.snapshot());
  assert.deepEqual(plain(only.map(row => row.id)), ['s3']);
  const moved = native.sessionDragOrder(fullOrder, flat, { sessionId: 's8', pinned: false }, { id: 's7', half: 'before' });
  assert.equal(moved.length, fullOrder.length);
  assert.equal(moved.includes('s3'), true);
  assert.deepEqual([...moved].sort(), [...fullOrder].sort());
});

test('Workspace Tree keeps original membership/ancestor geometry and search remains flat, filter-before-cap', () => {
  const data = fixtureData(30);
  const filtered = registry(['s9', 's29', 's30']);
  const groups = native.deriveGroups(data.list, data.workspaces, data.rowState, data.statuses, data.view, filtered.snapshot());
  assert.deepEqual(plain(groups.map(group => group.key)), ['child', '']);
  assert.equal(native.owningParentFolder('/project/nested', data.workspaces.map(ws => ws.path)), '/project');
  const search = native.deriveSearchResults(data.list, data.workspaces, 'Topic', ['s3'], 'default', data.statuses, { items: [], hasMore: false }, 2, filtered.snapshot());
  assert.deepEqual(plain(search.items.map(item => item.id)), ['s30', 's29']);
  assert.equal(search.hasMore, true);
  assert.equal(search.items.every(item => !('sessions' in item)), true);
  const content = native.deriveSearchResults(data.list, data.workspaces, 'no-local-match', [], 'show', data.statuses, { items: [{ sessionId: 's1', snippet: 'skip' }, { sessionId: 's29', snippet: 'accepted' }, { sessionId: 's30', snippet: 'accepted 2' }], hasMore: false }, 1, filtered.snapshot());
  assert.deepEqual(plain(content.items.map(item => item.id)), ['s29']);
  assert.equal(content.hasMore, true);
});

test('filter does not exempt current selection, blanks or subagents and never mutates retained main', () => {
  const data = fixtureData();
  data.list.byId.s2.blank = true;
  data.list.byId.s4.origin = 'subagent';
  const filtered = registry(['s2', 's4', 's8']);
  const rows = native.deriveFlat(data.list, data.list.ids, data.rowState, data.statuses, filtered.snapshot());
  assert.deepEqual(plain(rows.map(row => row.id)), ['s8']);
  assert.equal(data.list.byId.s1.retainedBy.mainView, 1);
  assert.equal(rows.some(row => row.id === 's1'), false);
});

test('real React native Browser fixture declares root/list seats, shows header/status/filtered-empty and restores views', () => {
  const data = fixtureData();
  const fixture = captureBrowser(sdk, data);
  for (const name of ['sidebar.workspaces.header.action', 'sidebar.workspaces.filter.status']) assert.deepEqual(plain(fixture.registration.config.children[name]), { kind: 'list', scope: 'root' });
  assert.equal(fixture.provided.hooks.sessionFilters, fixture.ctx.uiWorkspace.sessionFilters);
  assert.equal(fixture.provided.hooks.workspaces.getSnapshot().items, data.workspaces);
  const baseline = fixture.render();
  assert.match(baseline.html, /Fixture filter/);
  assert.deepEqual(plain(baseline.slotCalls.find(call => call.name === 'sidebar.workspaces.header.action').props), { wide: true, searchExpanded: false }, 'native header must supply actual owner layout/search state');
  assert.equal(baseline.slotCalls.some(call => call.name === 'sidebar.workspaces.filter.status'), false);
  const input = source(filterValue(['s8']));
  const stop = fixture.ctx.uiWorkspace.sessionFilters.register({ id: 'fixture', source: input });
  for (const groupBy of ['workspace', 'workspace-tree', 'flat']) {
    const result = fixture.render({ groupBy });
    assert.equal(result.slotCalls.find(call => call.name === 'sidebar.workspaces.filter.status').props.visibleCount, 1);
    assert.equal(data.list.byId.s1.retainedBy.mainView, 1);
  }
  input.set(filterValue([]));
  for (const groupBy of ['workspace', 'workspace-tree', 'flat']) assert.match(fixture.render({ groupBy }).html, /filter.noMatches/);
  stop();
  assert.equal(fixture.render().html, baseline.html);
  assert.equal(input.listenerCount(), 0);
});

test('zero-match pending/unknown fallbacks stay truthful without a status contribution in group/flat/search', () => {
  const data = fixtureData();
  const fixture = captureBrowser(sdk, data);
  const input = source(filterValue([], true, ['s1'], ['s2', 's3']));
  const stop = fixture.ctx.uiWorkspace.sessionFilters.register({ id: 'empty-state', source: input });
  for (const groupBy of ['workspace', 'workspace-tree', 'flat']) {
    const pending = fixture.render({ groupBy, statusOccupied: false }).html;
    assert.match(pending, /filter.checking/);
    assert.doesNotMatch(pending, /filter.noMatches|filter.unknown/);
  }
  input.set(filterValue([], true, [], ['s2', 's3']));
  for (const groupBy of ['workspace', 'workspace-tree', 'flat']) assert.match(fixture.render({ groupBy, statusOccupied: false }).html, /filter.unknown:2/);
  stop();
  for (const [pending, unknown, expected] of [[['s1'], ['s2'], /filter.checking/], [[], ['s2', 's3'], /filter.unknown:2/]]) {
    const searchSDK = loadModule(false, { stateOverrides: ['Topic', true, undefined, { query: 'Topic', status: 'ready', items: [], hasMore: false }] }).module;
    const search = captureBrowser(searchSDK, data);
    const dispose = search.ctx.uiWorkspace.sessionFilters.register({ id: 'search-empty', source: source(filterValue([], true, pending, unknown)) });
    assert.match(search.render({ statusOccupied: false }).html, expected);
    dispose();
  }
});

test('no-extension native Browser markup equals official upstream for every grouping and archive mode', () => {
  for (const archivedFilter of ['default', 'show', 'only']) {
    const data = fixtureData(); data.rowState.archivedFilter = archivedFilter;
    const patched = captureBrowser(sdk, data);
    const upstream = captureBrowser(loadModule(true).module, data);
    for (const groupBy of ['workspace', 'workspace-tree', 'flat']) {
      assert.equal(patched.render({ groupBy, headerOccupied: false }).html, upstream.render({ groupBy, headerOccupied: false }).html);
    }
  }
});

test('actual native React search mounts flat filtered results and retains contributed header controls while open', () => {
  const searchSDK = loadModule(false, { stateOverrides: ['Topic', true] }).module;
  const data = fixtureData(30);
  const fixture = captureBrowser(searchSDK, data);
  const input = source(filterValue(['s29', 's30']));
  const stop = fixture.ctx.uiWorkspace.sessionFilters.register({ id: 'search-fixture', source: input });
  const result = fixture.render({ groupBy: 'workspace-tree' });
  assert.match(result.html, /Topic 30/);
  assert.match(result.html, /Topic 29/);
  assert.match(result.html, /Fixture filter/);
  assert.deepEqual(plain(result.slotCalls.find(call => call.name === 'sidebar.workspaces.header.action').props), { wide: true, searchExpanded: true }, 'open native search must project true owner search state to the header contribution');
  assert.doesNotMatch(result.html, /GAkraW_headerActionsHidden/);
  assert.match(result.html, /GAkraW_searchTree/);
  assert.doesNotMatch(result.html, /GAkraW_groupSection/);
  assert.equal(result.slotCalls.find(call => call.name === 'sidebar.workspaces.filter.status').props.visibleCount, 2);
  stop();
});

test('search header occupancy uses native extension-aware cap and exact no-extension collapse behavior', () => {
  assert.match(code, /max-width:60%;/);
  assert.doesNotMatch(code, /GAkraW_headerActions\{[^}]*max-width:60px/);
  assert.match(code, /wide && searchExpanded && !headerActionsAvailable && WorkspaceBrowser_module_css_default.headerActionsHidden/);
  assert.match(code, /normalizedQuery !== "" \? \(0, react_jsx_runtime.jsx\)\(SearchResults, \{\s+sessionFilters, renderSlot,/);
});
