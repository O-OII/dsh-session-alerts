# Completed main sessions: semantics and composition

[README](../README.md) · [简体中文](completed-filter.zh-CN.md)

## Native workspace UI, not a replacement list

The check-circle button occupies the root/list `sidebar.workspaces.header.action` seat in the native workspace header. It exposes a stable accessible name, `aria-pressed`, keyboard-native button behavior and a tooltip. `sidebar.workspaces.filter.status` supplies loading, unknown and filtered-empty information; its recovery disables only this completed-only contribution. Page reload returns the local toggle to off.

The contribution registers `id: dsh-native-taskbar-badge.completed` with `ctx.uiWorkspace.sessionFilters.apiVersion === 1`. The source publishes immutable `{ enabled, matchingSessionIds, pendingSessionIds, unknownSessionIds }` snapshots. The SDK AND-combines enabled sources and applies them to native grouped/tree/flat/search candidates before its local result limit. Complete account membership, saved/manual order, pin/archive sets and search text are not rewritten. A selected conversation can stay open even if its row does not match. Existing Host content-search caps/ranking remain unchanged.

Stock rc.3 lacks these extension seats/service. The isolated [compatibility engineering project](../compat/workspace-sdk/README.md), separately approved by the user, adds them to the exact SHA-pinned official workspace package. It preserves the original module ID/dependency graph; it does not modify ASAR. It is a local-only SDK artifact, **not an upstream release and not part of the main npm archive**. Without API v1, the plugin issues an unavailable diagnostic/status where supported and registers no pretend filter button.

## What success means

The independent Host projection `sessionAlertsCompletion` folds committed events. Its work accounting follows the exported official `dsh-agent.foldConsumedWork` rules:

- A real step accounts for work. A consumed pre-step unsuccessful ending accounts for its failure.
- A pre-step `completed` claim or empty no-op does not invent success and does not replace a previous accounting failure.
- Canceled input dropped unrun invalidates previous success until later genuinely accounted work closes.
- Latest accounted work must end `completed`; errors, blocked/output-limit/abort/interrupted/forked endings do not qualify.
- A current open turn or approval is excluded. Client runtime running/pending status provides another immediate veto.
- Goal replay delegates to the **official strict goal projection definition**, including its persistent failure flag. A corrupt goal can retain a stale ordinary `goal` wire value; the custom completion value becomes unknown instead of trusting that stale phase.
- The accounting end retains its goal phase/id. Active/paused/blocked goal rounds remain excluded after a goal clear. The conservative policy requires a goal already be `complete` at that accounting end; a later complete edge alone does not promote the prior intermediate end.
- Work accounting uses only the Session's owned suffix (`event.seq >= inheritedEventCount`). Goal validation covers the complete inherited history. The cut is checkpointed. Ordinary main forks remain eligible; `parentSessionId` alone never makes a Session a subagent.

This is **DSH terminal success**, not independent acceptance of a business objective or every external process. Recovered intermediate tool/assistant-attempt errors are not permanent failures; the final accounting outcome controls.

## Cold/read-only client authority and races

The client calls the official `remote.session.projections({ sessionId }, signal)` directly, with at most **four** concurrent reads. It does not retain/open conversations, call `refreshProjections` (which can short-circuit a ready cache missing a new key), activate Agents, write Session/catalog metadata or acknowledge unread results.

Its own cache is scoped to the connection generation and canonical catalog/projection fingerprints. Known cold histories are not re-read on a recurring 1.5-second sweep. Meaningful live catalog/runtime/projection updates invalidate affected evidence; unrelated retention/view changes do not. Unknown baselines retry after 30 seconds or an explicit user recheck. A user re-enable explicitly refreshes the view. Disable/disposal abort queued/in-flight work and removes subscriptions/timers; stale generation/revision responses are discarded. Missing/malformed/migration-required data is unknown and excluded.

Running subagents are mapped through canonical `origin: subagent` and the actual ClientSessions DTO's `parentId` ancestry (`parentSessionId`/header inputs are fallback only), using Session/runtime running facts. A confirmed active descendant vetoes its associated main root. Broken/cyclic ancestry is recorded as unresolved but is not evidence against unrelated mains; an unassociated orphan never makes every main unknown. This policy only excludes confirmed running descendants and does not claim full-family proof. The scan is bounded by the loaded catalog; it does not recursively discover unlimited external jobs. Background jobs/external systems not represented by this contract are not independently certified.

Completion is not unread: reading a successful result does not remove it from this view. The native unread engine is unchanged.

## Safe component choices

- **Normal new/full installation:** root bundle supplies the existing native engine/client plus the independent `./completion` Host entry and sidebar code. Native settings/path validation do not gate the completion entry. Normal root reload still follows the documented in-memory unread lifecycle.
- **Add sidebar beside an already-running older engine:** the generated `sidebar-package` is a separate private local package, `dsh-session-alerts-sidebar`. Its Host is completion-only (`inject: ['sessionProjections']`); its client is sidebar-only. It includes copied shared completion sources, a distinct package/module identity, locale metadata and a bundle patch. It never starts Python or contributes the old read marker. The old engine remains its real old version; do not describe this as upgrading that engine in place.
- Do not mount a completion file URL from the root source alongside another installed root of the same npm package: ClientModules can see duplicate package roots/client contributions. Use the independent sidecar.
- Do not enable the full 0.3.0 client and the sidecar simultaneously; both intentionally own the same filter ID.
- No tests install, change a live profile, restart DSH, push code or invoke a paid model. Local deployment/SDK composition is a separate operator action; if a restart is required, stop and obtain permission first.
