# Historical completion helpers — not the unread bell

[README](../README.md) · [简体中文](completed-filter.zh-CN.md) · [Current unread filter](unread-filter.md)

The 0.3.0 baseline used a completed-main-session view. The current bell instead filters native `completionUnread` and does **not** call these completion helpers. This filename is retained for existing links and compatibility documentation; it is not a second active toolbar mode.

## Retained success projection

The independent Host entry `./completion` registers `sessionAlertsCompletion`, folding committed events with work accounting based on official `dsh-agent.foldConsumedWork` semantics:

- Real steps account for work; consuming input before an unsuccessful pre-step ending accounts for failure.
- A pre-step `completed` claim or empty no-op cannot invent success or wash away a previous accounting failure.
- Dropped, unrun canceled input invalidates prior success until later accounted work ends.
- The latest accounted work must end `completed`; errors, blocked/output-limit/abort/interrupted/forked endings do not qualify.
- Open turns and approvals are not successful completion evidence.
- Goal replay uses the official strict goal projection, including persistent failure. Unknown/corrupt state does not trust a stale ordinary goal wire value.
- Goal phase/id at accounting end are retained. Active/paused/blocked rounds are not promoted by a later clear; a goal must already be complete at the accounting end.
- Work accounting uses the owned suffix (`event.seq >= inheritedEventCount`), while goal validation covers inherited history. Ordinary forks are not subagents merely because they have a parent ID.

This classifies consumed DSH work, not independent business-objective acceptance. Recovered intermediate tool errors do not permanently disqualify later successful work. These values do not establish whether a person read the result.

## Retained reader/filter utilities

`completion-reader.mjs` can read official `remote.session.projections({ sessionId }, signal)` with at most four workers, without retaining/opening conversations or mutating Session metadata. The old `completed-filter.mjs` keeps generation-scoped caches, unknown retry/cancellation, and canonical descendant activity handling for compatibility and regression coverage. Explicit retry/re-enable queued during a batch preserves force; unknown rechecks publish pending while in flight.

These utilities are **not included in the generated unread sidebar factory**. The unread filter does no cold projection reads and does not exclude native unread solely because work failed, a goal is active, or a descendant is running. Do not attach the old completed filter ID alongside the current bell as an implicit AND condition.

## Components and compatibility

- The full root bundle retains the completion Host entry alongside the native badge and unread sidebar.
- The private `sidebar-package` is a separate completion-only Host plus unread-only client. Its retained projection does not start Python or gate the client on native configuration.
- Use either the full root client or the sidecar, not both: both current clients own `dsh-native-taskbar-badge.unread`.
- Stock rc.3 still needs the separately operator-approved [pinned workspace SDK extension](../compat/workspace-sdk/README.md) for the sidebar API. The compatibility subtree is not an upstream release and is excluded from the main package archive.
- Do not load the same npm package through multiple installed/file-URL roots to add its Host entry; duplicate client contributions can result.

Unit/oracle tests are fake/read-only and never install plugins, modify a live profile, restart DSH or call paid models. Deployment remains an explicit operator action.
