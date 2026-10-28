# Unread sessions: native state and filter composition

[README](../README.md) · [简体中文](unread-filter.zh-CN.md)

## What the bell does

The 16-pixel outline bell occupies `sidebar.workspaces.header.action` in the native workspace toolbar. Its native button exposes `aria-pressed`, keyboard activation, and matching accessible label/tooltip:

| State | English | Simplified Chinese |
| --- | --- | --- |
| Off | Unread filter | 未读过滤 |
| On | Reset filter | 重置条件 |

Click once to keep unread main sessions; click again to remove **only this unread condition**. Search text, archive/pin sets, grouping, ordering, workspace membership and other filters are preserved. Filtering does not open/retain a session, send a read receipt, mark everything read, delete or archive anything. A conversation already open may remain open while its read row is filtered out.

The toggle is page-local and off by default. An empty match set remains an enabled filter so a later native unread notification can appear immediately. The status seat explains that no unread sessions match and offers the same reset action. No completion-loading or projection-retry status is involved.

## One native unread bit, not task success

`unread-filter.mjs` subscribes to the public `sessions.list` and `uiSession.sessionStatus` sources. A catalog main session matches only when:

```js
statusMap.get(sessionId)?.completionUnread === true
```

This is the same bit the native workspace internally aliases to its row presentation field named `completed`. That internal name does **not** mean the retained `sessionAlertsCompletion` success projection.

- Previously read successful results do not match. A missing/false/non-boolean flag does not match.
- Errors or other stopped work can match if the native unread flag is true; no successful-work projection is required.
- `pendingInteraction` alone does not mean unread. Running state, goal phase, a running descendant or a colored status dot are not substitutes for the native flag and do not independently veto a true flag.
- Subagents/delegated children are excluded from main-session candidates. A normal fork's parent ID alone is not grounds for exclusion.
- There are no cold projection/log reads, classification RPCs, timers or inferred historical read watermarks in this filter.

The native flag is local to DSH's UI-service lifecycle: background running-to-stopped observations can set it, starting again or main-view retention can clear it, and an initial idle history baseline is not automatically unread. A fresh page cannot reconstruct durable unread history from completed work. The filter deliberately preserves these native rules rather than inventing persistence.

## Native workspace extension and composition

The contribution registers `dsh-native-taskbar-badge.unread` with `ctx.uiWorkspace.sessionFilters.apiVersion === 1`. It publishes immutable `{ enabled, matchingSessionIds, pendingSessionIds, unknownSessionIds }` snapshots; the latter two sets are empty because this filter reads live flags synchronously. The registry AND-combines active sources before native grouped/tree/flat/search result limits. It does not hide DOM rows or replace the workspace list.

**Stock rc.3 does not provide these extension seats/service.** The separately operator-approved [compatibility engineering project](../compat/workspace-sdk/README.md) adds them to an exact SHA-pinned official workspace baseline, preserving its module identity/dependency graph without modifying ASAR. It is not an upstream SDK release and is excluded from the main package archive. Without the required workspace API, the plugin reports unavailable instead of mounting a pretend toggle.

Use either the full root client or the independent `sidebar-package`, not both: they own the same filter ID. The sidecar adds no Python helper or native read marker. Its completion-only Host component remains for compatibility, but the bell no longer consumes completion classification. [Historical completion projection](completed-filter.md) documents the retained helpers.

## Why the taskbar can differ

The taskbar counts Host-tracked unread terminal results **and optionally unresolved interactions**, once per main session. Its state is not the sidebar's browser-local flag set. The [read policy](behavior.md) safely synchronizes an eligible current native-read main view or an exposed exact Chat result; it never bulk-clears every false flag. Background reruns, hidden windows, notification preferences and waiting interactions can therefore make the two counts differ. Resetting the bell is never a taskbar reset.
