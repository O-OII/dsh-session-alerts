/** Client-only immutable workspace acceptance source. Never infers completion
 * from titles, unread flags or idle/running=false; never mutates Session stores.
 */
import { COMPLETION_KEY } from './completion-contract.mjs';
export const FILTER_ID = 'dsh-native-taskbar-badge.completed';
export function isMainSummary(summary) {
  return summary && typeof summary.id === 'string' && summary.id.length > 0 &&
    summary.origin !== 'subagent' && summary.header?.origin !== 'subagent' &&
    (summary.delegationDepth ?? summary.header?.delegationDepth ?? 0) === 0;
}
const isPending = status => status?.pendingInteraction !== undefined && status.pendingInteraction !== null;
// Public ClientSessions DTO uses parentId (including catalog/retained children).
// Host-shaped parentSessionId/header fields are only explicit fallback inputs.
const parentKey = summary => summary?.parentId ?? summary?.parentSessionId ?? summary?.header?.parentSession;
export function descendantActivity(byId, statuses) {
  const running = new Set(), unresolvedRunningIds = new Set();
  for (const child of Object.values(byId)) {
    if (child?.origin !== 'subagent' && child?.header?.origin !== 'subagent') continue;
    if (child.running !== true && statuses.get(child.id)?.running !== true) continue;
    let current = child; const seen = new Set();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      const parentId = parentKey(current);
      const parent = parentId === undefined ? undefined : byId[parentId];
      if (!parent) { unresolvedRunningIds.add(child.id); break; }
      if (isMainSummary(parent)) { running.add(parent.id); break; }
      current = parent;
    }
    if (current && seen.has(current.id) && !running.has(current.id) &&
        (parentKey(current) === current.id || seen.has(parentKey(current)))) unresolvedRunningIds.add(child.id);
  }
  // A disconnected running orphan is not evidence against every other main.
  // Only an ancestry path that reaches a canonical main can veto that main.
  return { running, unresolvedRunningIds };
}
export function createCompletedFilter({ sessions, statuses, generation, classify,
  schedule = setTimeout, cancel = clearTimeout, now = Date.now, unknownRetryMs = 30000, batchSize = 100 }) {
  let enabled = false, disposed = false, revision = 0, timer = null, request = null, activeRun = null, rerun = false;
  let observedGeneration = generation.getSnapshot(), lastSignature = '';
  const records = new Map(), listeners = new Set();
  let snapshot = { enabled: false, matchingSessionIds: new Set(), pendingSessionIds: new Set(), unknownSessionIds: new Set() };
  function inputs() {
    const list = sessions.getSnapshot(); const byId = list?.byId ?? {};
    const runtime = statuses?.getSnapshot?.() ?? new Map();
    const descendants = descendantActivity(byId, runtime);
    const ids = [...new Set(list?.ids ?? Object.keys(byId))];
    return ids.map(id => byId[id]).filter(isMainSummary).map(summary => {
      const status = runtime.get(summary.id);
      const busy = summary.blank === true || summary.running === true || status?.running === true ||
        isPending(status) || descendants.running.has(summary.id);
      const stamp = JSON.stringify([summary.updatedAt, summary.running, summary.blank, summary.origin,
        summary.depth ?? summary.delegationDepth, status?.running, status?.pendingInteraction?.key,
        busy, summary.projectionValues?.[COMPLETION_KEY]]);
      return { id: summary.id, stamp, busy };
    });
  }
  function publish(loading = new Set()) {
    const matchingSessionIds = new Set(), pendingSessionIds = new Set(), unknownSessionIds = new Set();
    if (enabled) for (const row of inputs()) {
      if (row.busy) continue;
      const record = records.get(row.id);
      if (loading.has(row.id) && (!record || record.stamp !== row.stamp)) pendingSessionIds.add(row.id);
      else if (!record || record.stamp !== row.stamp || record.state === 'unknown') unknownSessionIds.add(row.id);
      else if (record.state === 'completed') matchingSessionIds.add(row.id);
    }
    snapshot = { enabled, matchingSessionIds, pendingSessionIds, unknownSessionIds };
    for (const listener of [...listeners]) listener();
  }
  const source = { getSnapshot: () => snapshot, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); } };
  async function refresh(force = false) {
    if (disposed || !enabled) return;
    if (activeRun) { rerun = true; return; }
    cancel(timer); timer = null;
    const currentGeneration = generation.getSnapshot();
    if (!currentGeneration) { records.clear(); publish(); return; }
    if (observedGeneration !== currentGeneration) { records.clear(); observedGeneration = currentGeneration; }
    const rows = inputs(), ids = new Set(rows.map(row => row.id));
    for (const id of records.keys()) if (!ids.has(id)) records.delete(id);
    const wanted = rows.filter(row => !row.busy && (() => {
      const record = records.get(row.id);
      return force || !record || record.stamp !== row.stamp || record.state === 'unknown' && record.retryAt <= now();
    })());
    const loading = new Set(wanted.map(row => row.id)); publish(loading);
    if (!wanted.length) {
      const retryAt = Math.min(...[...records.values()].filter(record => record.state === 'unknown').map(record => record.retryAt));
      if (Number.isFinite(retryAt)) timer = schedule(() => void refresh(), Math.max(1000, retryAt - now()));
      return;
    }
    const token = ++revision, controller = new AbortController(); request = controller; activeRun = token;
    const valid = () => !disposed && enabled && !controller.signal.aborted && token === revision && generation.getSnapshot() === currentGeneration;
    try {
      for (let offset = 0; offset < wanted.length; offset += batchSize) {
        const selected = wanted.slice(offset, offset + batchSize);
        const response = await classify(selected.map(row => row.id), controller.signal);
        if (!valid()) return;
        if (!response?.ok || !Array.isArray(response.value?.sessions)) throw new Error('Completion authority unavailable');
        const byId = new Map(response.value.sessions.filter(item => item && typeof item.sessionId === 'string').map(item => [item.sessionId, item]));
        for (const row of selected) {
          const value = byId.get(row.id);
          const state = value && ['completed','running','waiting','error','incomplete','unknown'].includes(value.state) ? value.state : 'unknown';
          records.set(row.id, { state, stamp: row.stamp, retryAt: state === 'unknown' ? now() + unknownRetryMs : Infinity });
          loading.delete(row.id);
        }
        publish(loading);
      }
    } catch (error) {
      if (valid()) {
        for (const row of wanted) records.set(row.id, { state: 'unknown', stamp: row.stamp, retryAt: now() + unknownRetryMs });
        publish();
      }
    } finally {
      activeRun = null; request = null;
      if (!disposed && enabled && rerun) { rerun = false; void refresh(); }
      else if (!disposed && enabled) {
        // Only unknown/error baselines retry on a bounded timer. Known cold logs
        // are NOT re-read every 1.5 seconds; live catalog/projection events dirty them.
        const retryAt = Math.min(...[...records.values()].filter(record => record.state === 'unknown').map(record => record.retryAt));
        if (Number.isFinite(retryAt)) timer = schedule(() => void refresh(), Math.max(1000, retryAt - now()));
      }
    }
  }
  function invalidate(clear = false) {
    const currentGeneration = generation.getSnapshot();
    const signature = JSON.stringify(inputs().map(row => [row.id, row.stamp]));
    if (!clear && signature === lastSignature && currentGeneration === observedGeneration) return;
    lastSignature = signature;
    ++revision; request?.abort(); cancel(timer); timer = null;
    if (clear) records.clear();
    publish(); if (enabled) void refresh();
  }
  const unsubscribeSessions = sessions.subscribe(() => invalidate());
  const unsubscribeStatuses = statuses?.subscribe?.(() => invalidate()) ?? (() => {});
  const unsubscribeGeneration = generation.subscribe(() => invalidate(true));
  return {
    source,
    setEnabled(value) {
      value = Boolean(value);
      if (disposed || value === enabled) return;
      enabled = value; ++revision; request?.abort(); cancel(timer); timer = null; rerun = false;
      publish(); if (enabled) void refresh(true);
    },
    refresh: () => refresh(true),
    dispose() {
      disposed = true; ++revision; request?.abort(); cancel(timer);
      unsubscribeSessions(); unsubscribeStatuses(); unsubscribeGeneration(); listeners.clear();
    },
  };
}
