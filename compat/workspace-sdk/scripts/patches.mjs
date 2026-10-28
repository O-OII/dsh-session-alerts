// Exact, count-checked edits to SHA-pinned rc.3 compiled JavaScript. No regex edits.
export function makePatches(extension) {
  const patches = [];
  const add = (id, before, after, count = 1) => patches.push({ id, before, after, count });
  add('registry-source', '\t\t//#region lib/types/client/contract/slots.js', extension.split('\n').map(line => '\t\t' + line).join('\n') + '\n\t\t//#region lib/types/client/contract/slots.js');
  add('service-registry', '\t\t\tdirectoryPicker;\n\t\t\tworkspaces;', '\t\t\tsessionFilters = new SessionFiltersRegistry();\n\t\t\tdirectoryPicker;\n\t\t\tworkspaces;');
  add('service-dispose', '\t\t\t\t\t\tthis.lifetime.abort();', '\t\t\t\t\t\tthis.lifetime.abort();\n\t\t\t\t\t\tthis.sessionFilters.dispose();');
  add('root-hook', 'hooks: { workspaces: workspaces.list },', 'hooks: { workspaces: workspaces.list, sessionFilters: uiWorkspace.sessionFilters },');
  add('session-visible', 'function sessionVisible(session, current, archived, archivedFilter) {\n\t\t\tif (session.origin', 'function sessionVisible(session, current, archived, archivedFilter, filters = INACTIVE_SESSION_FILTERS) {\n\t\t\tif (filters.active && !filters.matches(session.id)) return false;\n\t\t\tif (session.origin');
  add('group-signature', 'function groupByWorkspace(list, workspaces, archived, archivedFilter, ungroupedOrder)', 'function groupByWorkspace(list, workspaces, archived, archivedFilter, ungroupedOrder, filters = INACTIVE_SESSION_FILTERS)');
  add('group-visible', 'if (!sessionVisible(summary, current, archived, archivedFilter)) continue;', 'if (!sessionVisible(summary, current, archived, archivedFilter, filters)) continue;');
  add('stray-visible', '!accounted.has(s.id) && sessionVisible(s, current, archived, archivedFilter)', '!accounted.has(s.id) && sessionVisible(s, current, archived, archivedFilter, filters)');
  add('empty-filtered-groups', 'if (archivedFilter === "only" && members.length === 0) continue;', 'if ((archivedFilter === "only" || filters.active) && members.length === 0) continue;');
  add('derive-groups-signature', 'function deriveGroups(list, workspaces, rowState, statuses, view)', 'function deriveGroups(list, workspaces, rowState, statuses, view, filters = INACTIVE_SESSION_FILTERS)');
  add('derive-groups-filter', 'groupByWorkspace(list, workspaces, archived, rowState.archivedFilter, view.ungroupedOrder)', 'groupByWorkspace(list, workspaces, archived, rowState.archivedFilter, view.ungroupedOrder, filters)');
  add('derive-flat-signature', 'function deriveFlat(list, sessionIds, rowState, statuses)', 'function deriveFlat(list, sessionIds, rowState, statuses, filters = INACTIVE_SESSION_FILTERS)');
  add('derive-flat-visible', 'sessionVisible(session, current, archived, rowState.archivedFilter) ? [session]', 'sessionVisible(session, current, archived, rowState.archivedFilter, filters) ? [session]');
  add('search-signature', 'function deriveSearchResults(list, workspaces, query, archivedSessionIds, archivedFilter, statuses, content, limit)', 'function deriveSearchResults(list, workspaces, query, archivedSessionIds, archivedFilter, statuses, content, limit, filters = INACTIVE_SESSION_FILTERS)');
  add('search-local-filter', 'summary.blank || !sessionVisible(summary, current, archived, archivedFilter)', 'summary.blank || !sessionVisible(summary, current, archived, archivedFilter, filters)');
  add('search-content-filter', '!summary.blank && sessionVisible(summary, current, archived, archivedFilter)', '!summary.blank && sessionVisible(summary, current, archived, archivedFilter, filters)');
  add('filter-status-component', '\t\tfunction EmptySessions({ rowState, onLeaveArchivedOnly, t }) {\n\t\t\tconst archivedOnly = rowState.archivedFilter === "only";', `\t\tfunction SessionFilterStatus({ sessionFilters, visibleCount, renderSlot }) {
\t\t\treturn sessionFilters.active ? renderSlot("sidebar.workspaces.filter.status", {
\t\t\t\tactive: true, visibleCount, pendingCount: sessionFilters.pendingCount, unknownCount: sessionFilters.unknownCount
\t\t\t}) : null;
\t\t}
\t\tfunction sessionFilterEmptyText(filters, t) {
\t\t\tif (filters.pendingCount > 0) return t("filter.checking");
\t\t\tif (filters.unknownCount > 0) return t("filter.unknown", { n: filters.unknownCount });
\t\t\treturn t("filter.noMatches");
\t\t}
\t\tfunction EmptySessions({ rowState, onLeaveArchivedOnly, sessionFilters = INACTIVE_SESSION_FILTERS, t }) {
\t\t\tconst archivedOnly = !sessionFilters.active && rowState.archivedFilter === "only";`);
  add('filtered-empty', 'children: archivedOnly ? t("empty.noneArchived") : t("empty.none")', 'children: sessionFilters.active ? sessionFilterEmptyText(sessionFilters, t) : archivedOnly ? t("empty.noneArchived") : t("empty.none")');
  add('tree-props', 'function SessionTree({ list, useSessionStatus,', 'function SessionTree({ sessionFilters, list, useSessionStatus,');
  add('tree-filter', 'ungroupedOrder: ungroupedSessionIds\n\t\t\t}), [', 'ungroupedOrder: ungroupedSessionIds\n\t\t\t}, sessionFilters), [\n\t\t\t\tsessionFilters,');
  add('tree-status', '\t\t\t\t\tworkspaceDropAtListStart &&', '\t\t\t\t\t(0, react_jsx_runtime.jsx)(SessionFilterStatus, { sessionFilters, visibleCount: groups.reduce((count, group) => count + group.sessionCount, 0), renderSlot }),\n\t\t\t\t\tworkspaceDropAtListStart &&');
  add('tree-empty-props', 'children: [groups.length === 0 && (0, react_jsx_runtime.jsx)(EmptySessions, {\n\t\t\t\t\t\t\trowState,', 'children: [groups.length === 0 && (0, react_jsx_runtime.jsx)(EmptySessions, {\n\t\t\t\t\t\t\tsessionFilters,\n\t\t\t\t\t\t\trowState,');
  add('flat-props', 'function FlatList({ list, sessionIds,', 'function FlatList({ sessionFilters, list, sessionIds,');
  add('flat-filter', 'deriveFlat(list, sessionIds, rowState, statuses), [', 'deriveFlat(list, sessionIds, rowState, statuses, sessionFilters), [\n\t\t\t\tsessionFilters,');
  add('flat-status', 'children: [(0, react_jsx_runtime.jsxs)(AnimatedRows, {', 'children: [(0, react_jsx_runtime.jsx)(SessionFilterStatus, { sessionFilters, visibleCount: rows.length, renderSlot }), (0, react_jsx_runtime.jsxs)(AnimatedRows, {');
  add('flat-empty-props', 'children: [rows.length === 0 && (0, react_jsx_runtime.jsx)(EmptySessions, {\n\t\t\t\t\t\trowState,', 'children: [rows.length === 0 && (0, react_jsx_runtime.jsx)(EmptySessions, {\n\t\t\t\t\t\tsessionFilters,\n\t\t\t\t\t\trowState,');
  add('search-props', 'function SearchResults({ useSessions,', 'function SearchResults({ sessionFilters, renderSlot, useSessions,');
  add('search-filter', 'deriveSearchResults(list, workspaces, query, archivedSessionIds, archivedFilter, statuses, currentRemote, resultLimit), [', 'deriveSearchResults(list, workspaces, query, archivedSessionIds, archivedFilter, statuses, currentRemote, resultLimit, sessionFilters), [\n\t\t\t\tsessionFilters,');
  add('search-status', 'children: [(0, react_jsx_runtime.jsxs)("div", {\n\t\t\t\t\tclassName: WorkspaceBrowser_module_css_default.list,', 'children: [(0, react_jsx_runtime.jsx)(SessionFilterStatus, { sessionFilters, visibleCount: results.items.length, renderSlot }), (0, react_jsx_runtime.jsxs)("div", {\n\t\t\t\t\tclassName: WorkspaceBrowser_module_css_default.list,');
  add('search-empty', 'children: t("search.noMatches")', 'children: sessionFilters.active ? sessionFilterEmptyText(sessionFilters, t) : t("search.noMatches")');
  add('browser-props', 'function WorkspaceBrowser({ wide, usePanelInfo,', 'function WorkspaceBrowser({ useSessionFilters, useHeaderActionsAvailable, wide, usePanelInfo,');
  add('browser-hooks', 'const home = useHostInfo((info) => info.home);', 'const sessionFilters = useSessionFilters((state) => state);\n\t\t\tconst headerActionsAvailable = useHeaderActionsAvailable((occupied) => occupied);\n\t\t\tconst home = useHostInfo((info) => info.home);');
  add('header-action-slot', 'children: [wide && (0, react_jsx_runtime.jsx)(ViewOptionsMenu, {', 'children: [wide && renderSlot("sidebar.workspaces.header.action", { wide, searchExpanded }), wide && (0, react_jsx_runtime.jsx)(ViewOptionsMenu, {');
  add('search-header-preserve', 'wide && searchExpanded && WorkspaceBrowser_module_css_default.headerActionsHidden', 'wide && searchExpanded && !headerActionsAvailable && WorkspaceBrowser_module_css_default.headerActionsHidden');
  add('header-width', '.GAkraW_headerActions{opacity:1;visibility:visible;max-width:60px;', '.GAkraW_headerActions{opacity:1;visibility:visible;min-width:0;max-width:60%;');
  add('header-flex', 'visibility 0s linear;flex:none;align-items:center;gap:4px;display:flex;overflow:hidden}.GAkraW_headerActionsHidden', 'visibility 0s linear;flex:0 1 auto;align-items:center;gap:4px;display:flex;overflow:hidden}.GAkraW_headerActionsHidden');
  add('search-child', '(normalizedQuery !== "" ? (0, react_jsx_runtime.jsx)(SearchResults, {', '(normalizedQuery !== "" ? (0, react_jsx_runtime.jsx)(SearchResults, {\n\t\t\t\t\t\t\tsessionFilters, renderSlot,');
  add('flat-child', ': groupBy === "flat" ? (0, react_jsx_runtime.jsx)(FlatList, {', ': groupBy === "flat" ? (0, react_jsx_runtime.jsx)(FlatList, {\n\t\t\t\t\t\t\tsessionFilters,');
  add('tree-child', '}) : (0, react_jsx_runtime.jsx)(SessionTree, {', '}) : (0, react_jsx_runtime.jsx)(SessionTree, {\n\t\t\t\t\t\t\tsessionFilters,');
  add('header-occupancy-hook', 'directoryFlow: browserFlowSource,', 'directoryFlow: browserFlowSource,\n\t\t\t\t\theaderActionsAvailable: flowSource("sidebar.workspaces.header.action"),');
  add('slot-declarations', 'name: "sidebar.workspaces",\n\t\t\t\tchildren: {', 'name: "sidebar.workspaces",\n\t\t\t\tchildren: {\n\t\t\t\t\t"sidebar.workspaces.header.action": { kind: "list", scope: "root" },\n\t\t\t\t\t"sidebar.workspaces.filter.status": { kind: "list", scope: "root" },');
  add('zh-empty', '"empty.none": "暂无会话",', '"filter.checking": "正在检查会话状态…",\n\t\t\t"filter.unknown": "暂无可确认符合条件的会话（{n} 个未判定）",\n\t\t\t"filter.noMatches": "没有符合当前筛选条件的会话",\n\t\t\t"empty.none": "暂无会话",');
  add('en-empty', '"empty.none": "No sessions yet",', '"filter.checking": "Checking session status…",\n\t\t\t"filter.unknown": "No confirmed matching sessions ({n} undetermined)",\n\t\t\t"filter.noMatches": "No sessions match the active filters",\n\t\t\t"empty.none": "No sessions yet",');
  add('public-filter-exports', '\t\texports.apply = apply;', '\t\texports.SessionFiltersRegistry = SessionFiltersRegistry;\n\t\texports.filterSessions = filterSessions;\n\t\texports.workspaceSessionFilterDerivations = Object.freeze({ deriveGroups, deriveFlat, deriveSearchResults, watermarkRows, sessionDragOrder, sessionMemberIds, owningParentFolder });\n\t\texports.apply = apply;');
  add('remove-stale-sourcemap', '//# sourceMappingURL=client.js.map', '// Local generated SDK artifact; exact edits and hashes: ../AUDIT.json');
  return patches;
}
