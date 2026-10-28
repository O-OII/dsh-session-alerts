# Per-session counting and revision-safe read receipts

[README](../README.md) · [简体中文](behavior.zh-CN.md)

## Counted attention is not the sidebar filter

Count the union of main sessions with an unread eligible result or an unresolved input request, once per session. Subagent origin/delegation is excluded. Display `1`–`99`, then `99+` (logical count capped at 999). Eligible completion/error/blocked/output-limit events can count regardless of which application is foreground.

The [bell filter](unread-filter.md) instead reads native browser-local `completionUnread` flags. It is not a list of successful tasks, and resetting the bell neither acknowledges results nor clears the taskbar. Waiting interactions, notification preferences, background reruns and different state lifetimes can make these two sets differ.

## Two scoped acknowledgement paths

Both paths use official public client services and the same authenticated per-session Host compare-and-swap (CAS). Neither performs a global clear or infers all sessions read from OS foreground focus.

### Current native-read main view

The client installs one lifecycle-owned synchronization driver, independently of any Chat footer. It requires all of:

- `uiSession.current` identifies an existing main session, not a subagent/delegated child.
- The catalog is `ready`, `blank` is explicitly `false`, and `retainedBy.mainView` is a positive safe integer. Missing or malformed proof fails closed.
- Native `uiSession.sessionStatus` explicitly reports `completionUnread === false` for that session.
- The document is visible and focused, and the connection generation remains the same.

Only this current session's pending terminal revision is queried and acknowledged. It need not scroll back to an old result footer. Source notifications, focus/visibility changes and reconnects invalidate in-flight evidence. A single two-second heartbeat while eligible catches later results or publication-order races; there is no background sweep and at most one in-flight request per driver. Hiding/unloading the view cancels requests/timers and releases subscriptions.

A fresh page's false unread defaults do **not** authorize a bulk read of every catalog session. Native read state is a bounded input to this current-view policy, not a durable read watermark. A result appearing between `pending` and `read` changes the Host revision and rejects the stale CAS; a later eligible cycle may acknowledge that new revision as well.

### Exact visible Chat result footer

The existing footer contribution remains an independent path:

1. Register a one-pixel measurement marker in the official `conversation.chat.turnTail` list Slot; do not replace Chat or patch application sources.
2. Normalize the Slot's current `TimelineTurn` object (`turn.turn`) or legacy numeric turn. Read the reactive official Chat timeline's actual `turn/end.seq`. The Slot's own `seq` or embedded old end is not authoritative.
3. Require the active main-session identity, document visibility/focus, IntersectionObserver intersection, and rechecked marker geometry/visibility.
4. Read only that session's pending terminal revision, require the exact displayed turn/end sequence, and send `{ sessionId, revision, kind, turn, eventSeq }`.

Thus displaying an old footer alone cannot acknowledge a newer result. If the separate current native-read main-view path qualifies, it can acknowledge the current terminal without relying on that old footer. Missing IntersectionObserver disables the footer path, not an otherwise supported current-view path.

## Shared Host fence

The Host checks owner access, payload shape, cancellation, mount lifetime, random mount epoch and the exact current revision. Its synchronous CAS clears only the matching terminal result; clients do not optimistically decrement the number. ACK-before-new-result leaves that new result pending; new-result-before-old-ACK rejects the old acknowledgement. Duplicate/two-window acknowledgements clear one result once. The Host stores no sticky active-window lease capable of acknowledging future events on its own.

These browser conditions are read-policy evidence, not eye-tracking or proof of comprehension. OS occlusion not reflected in document visibility cannot be proven.

## Waiting, cancellation and lifecycle

- With `notifyOnWaiting`, approvals/questions count until their actual decision/answer or owning operation ends. Neither read path resolves a waiting interaction by viewing it.
- Terminal unread and temporary waiting are independent within one counted session. Reading a terminal can leave the session counted for a live request. A new turn/wait and its resolution do not by themselves erase an older unread result.
- A new eligible terminal supersedes the older result and retires waits from its turn. Aborts do not notify; they retire waiting while preserving older unread. Restored `interrupted`/`forked` history does not notify.
- Successful intermediate active-goal turns are suppressed by default; goal completion and eligible failures can still count.
- Session-store detach is object disposal, not read/deletion proof: terminal unread and turn dedup survive; temporary waits retire and late events are rejected until a new valid turn starts.
- Page reload, disconnect and helper restart preserve Host-memory state. **Host restart, plugin reload/disable and crash do not persist it.** Historical logs are never replayed into unread. Deleted/unviewable historical sessions may remain pending until plugin reset; no durable deletion API is inferred.

## Native display and limits

The helper only draws the Host aggregate, even in the foreground. It never reads OS foreground focus. All visible windows whose complete executable path matches receive the same overlay; cleanup revalidates handles and topology/error recovery retries the desired count. No title matching or application identity rewriting. Different Host instances sharing one executable are not distinguished; do not run competing providers. Tray-hidden windows are not restored.

Unsupported native-read sources fail closed; an inactive/hidden view is not read proof. The footer path requires materialized Chat data. These paths do not promise exact equality with the native sidebar's browser-local unread set in every background/window scenario. Fake tests establish state, qualification, cancellation and bridge ordering, not all real-browser layout, shell/DPI or Explorer behavior. No synthetic preview is a native screenshot.
