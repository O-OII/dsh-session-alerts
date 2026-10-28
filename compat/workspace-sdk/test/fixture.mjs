import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reactRequire = createRequire(process.env.DSH_SDK_TEST_REACT_ROOT
  ? path.join(path.resolve(process.env.DSH_SDK_TEST_REACT_ROOT), 'react/package.json')
  : path.join(root, 'package.json'));
export const React = reactRequire('react');
export const { renderToStaticMarkup } = reactRequire('react-dom/server');
const jsxRuntime = reactRequire('react/jsx-runtime');
export function source(initial) {
  let snapshot = initial;
  const listeners = new Set();
  return { getSnapshot: () => snapshot, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    set: next => { snapshot = next; for (const listener of [...listeners]) listener(); }, emit: () => { for (const listener of [...listeners]) listener(); }, listenerCount: () => listeners.size };
}
export const filterValue = (ids, enabled = true, pending = [], unknown = []) => ({ enabled, matchingSessionIds: new Set(ids), pendingSessionIds: new Set(pending), unknownSessionIds: new Set(unknown) });
function store(initial) { const result = source(initial); return { ...result, set: result.set }; }
const primitives = new Proxy({}, { get: (_target, name) => {
  if (name === 'writeClipboard') return async () => true;
  return function FixturePrimitive(props) { return React.createElement('span', { 'data-primitive': String(name) }, props.children ?? props.anchor ?? null); };
} });
export function loadModule(baseline = false, { stateOverrides = [] } = {}) {
  let definition;
  let stateIndex = 0;
  // Fixture-only adapter of React's public useState API: mounts native search already open.
  // The production bundle and React's own object/stores are not changed.
  const fixtureReact = stateOverrides.length ? { ...React, useState(initial) {
    const index = stateIndex++;
    return React.useState(index < stateOverrides.length ? stateOverrides[index] : initial);
  } } : React;
  const filename = path.join(root, baseline ? 'vendor/ui-workspace/lib/client.js' : 'dist/ui-workspace/lib/client.js');
  let code = fs.readFileSync(filename, 'utf8');
  if (baseline) code = code.replace('\t\texports.apply = apply;', '\t\texports.workspaceSessionFilterDerivations = { deriveGroups, deriveFlat, deriveSearchResults, watermarkRows, sessionDragOrder, sessionMemberIds, owningParentFolder };\n\t\texports.apply = apply;');
  const context = vm.createContext({ window: { __ModuleLoader__: { load(value) { definition = value; } } }, console, AbortController, setTimeout, clearTimeout });
  vm.runInContext(code, context, { filename });
  const module = definition.factory(name => {
    if (name === 'react') return fixtureReact;
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name === '@deepseek-ai/cordis') return { Service: class { constructor(ctx, name) { ctx[name] = this; } } };
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
    if (name === '@deepseek-ai/dsh-client-store') return {
      createSnapshotStore: store,
      defineStore: spec => ({ create: () => {
        const snapshot = spec.init();
        return { getSnapshot: () => snapshot, actions: Object.fromEntries(Object.entries(spec.actions).map(([name, action]) => [name, (...args) => action(snapshot, ...args)])) };
      } }),
    };
    throw new Error(`Unexpected module dependency ${name}`);
  });
  return { module, definition, code };
}
export function fixtureData(count = 12) {
  const ids = Array.from({ length: count }, (_, i) => `s${i + 1}`);
  const byId = Object.fromEntries(ids.map((id, i) => [id, { id, title: `Topic ${i + 1}`, cwd: '/project', blank: false, updatedAt: Date.UTC(2026, 0, 1, 0, i), retainedBy: i === 0 ? { mainView: 1 } : {}, running: false }]));
  return {
    list: { ids, byId, projectionsBySession: {}, phase: 'ready' },
    workspaces: [{ workspaceId: 'parent', path: '/project', title: 'Project', createdAt: '2026-01-01T00:00:00Z', sessionIds: ids.slice(0, 8) }, { workspaceId: 'child', path: '/project/nested', title: 'Nested', createdAt: '2026-01-01T00:00:00Z', sessionIds: ids.slice(8, 10) }],
    rowState: { archivedSessionIds: ['s3'], pinnedSessionIds: ['s2', 's9'], archivedFilter: 'default' }, statuses: new Map(),
    view: { expandedGroups: ['parent', 'child', ''], ungroupedOrder: ids.slice(10) },
  };
}
export function captureBrowser(module, data) {
  const effects = [], registrations = new Map();
  let provided;
  const sessions = { list: source(data.list), searchResultLimit: 20 };
  const workspaceSnapshot = { items: data.workspaces, phase: 'ready', state: 'ready', ...data.rowState };
  const workspaces = { list: source(workspaceSnapshot) };
  const ctx = {
    sessions, workspaces, get: name => ctx[name], remote: { directoryPicker: {}, $host: {} },
    effect(callback, label) { effects.push({ callback, label }); },
    locale: { bind: () => key => key, register: () => () => {} },
    remoteAccess: { source: () => source(true) }, shortcuts: { catalog: source([]) },
    slots: {
      provideRoot(value) { provided = value; }, registerFactory() {},
      entries: () => [], subscribe: () => () => {},
      inject(name, callback) { if (name === 'sidebar.workspaces') callback(); },
      register(config, component) { registrations.set(config.name, { config, component }); return () => {}; },
    },
  };
  module.apply(ctx);
  const registration = registrations.get('sidebar.workspaces');
  const injected = registration.config.inject();
  const hook = snapshot => selector => selector(snapshot);
  const render = ({ groupBy = 'workspace', headerOccupied = true, statusOccupied = true } = {}) => {
    const view = { groupBy, orderBy: 'manual', groupExpansion: { parent: true, child: true, '': true }, sessionOrderByAccount: {}, archivedFilter: data.rowState.archivedFilter };
    const statuses = data.statuses;
    const slotCalls = [];
    const props = {
      ...injected, wide: true, usePanelInfo: hook({ activePanelId: null }), expandSidebar() {},
      useSessions: hook(data.list), useSessionStatus: hook(statuses), useWorkspaces: hook(workspaceSnapshot),
      useStore: hook(view), actions: registration.config.store.create().actions,
      useSessionFilters: selector => selector(React.useSyncExternalStore(ctx.uiWorkspace.sessionFilters.subscribe, ctx.uiWorkspace.sessionFilters.getSnapshot, ctx.uiWorkspace.sessionFilters.getSnapshot)),
      useHeaderActionsAvailable: hook(headerOccupied), useHostInfo: hook({ home: '/home' }),
      useShortcuts: hook([]), useWorkspaceShortcuts: hook({ searchRequest: 0, addRequested: false, directoryBusy: false }), useDirectoryFlow: hook(true),
      renderSlot(name, props) { slotCalls.push({ name, props }); return name === 'sidebar.workspaces.header.action' && headerOccupied ? React.createElement('button', { 'aria-label': 'Fixture filter' }, 'Filter') : name === 'sidebar.workspaces.filter.status' && statusOccupied ? React.createElement('output', {}, `${props.visibleCount} matches`) : null; },
      t: (key, params) => params?.n === undefined ? key : `${key}:${params.n}`,
    };
    const html = renderToStaticMarkup(React.createElement(registration.component, props));
    return { html, slotCalls, props, view };
  };
  return { ctx, render, registration, provided, effects };
}
export const plain = value => JSON.parse(JSON.stringify(value));
