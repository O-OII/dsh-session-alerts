/** Live unread filter using the same public status bit as the native sidebar dot.
 * Completion success, running state, goal phase and native badge totals are NOT
 * read evidence. Never open sessions, read logs, issue RPCs or mark anything read.
 */
export const UNREAD_FILTER_ID = 'dsh-native-taskbar-badge.unread';
export function createUnreadFilter({ sessions, statuses }) {
  let enabled = false, disposed = false;
  const listeners = new Set();
  let snapshot = { enabled, matchingSessionIds: new Set(), pendingSessionIds: new Set(), unknownSessionIds: new Set() };
  function publish() {
    if (disposed) return;
    const matchingSessionIds = new Set();
    if (enabled) {
      const list = sessions.getSnapshot(), byId = list?.byId ?? {};
      const runtime = statuses.getSnapshot();
      for (const id of list?.ids ?? Object.keys(byId)) {
        const summary = byId[id];
        if (!summary || typeof id !== 'string' || !id || summary.origin === 'subagent' ||
            summary.header?.origin === 'subagent' || (summary.delegationDepth ?? summary.header?.delegationDepth ?? 0) !== 0) continue;
        if (runtime.get(id)?.completionUnread === true) matchingSessionIds.add(id);
      }
    }
    if (snapshot.enabled === enabled && matchingSessionIds.size === snapshot.matchingSessionIds.size &&
        [...matchingSessionIds].every(id => snapshot.matchingSessionIds.has(id))) return;
    snapshot = { enabled, matchingSessionIds, pendingSessionIds: new Set(), unknownSessionIds: new Set() };
    for (const listener of [...listeners]) listener();
  }
  const unsubscribeSessions = sessions.subscribe(publish);
  const unsubscribeStatuses = statuses.subscribe(publish);
  return {
    source: { getSnapshot: () => snapshot, subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener); return () => listeners.delete(listener);
    } },
    setEnabled(value) { if (!disposed) { enabled = Boolean(value); publish(); } },
    dispose() { if (disposed) return; disposed = true; unsubscribeSessions(); unsubscribeStatuses(); listeners.clear(); },
  };
}
