# Per-session counting and exact read receipts

[README](../README.md) · [简体中文](behavior.zh-CN.md)

## The only acknowledgement policy

Count the union of main sessions with an unread eligible result or an unresolved input request, once per session. Subagent origin/delegation is filtered. Display `1`–`99`, then `99+` (logical count capped at 999). Main-session completion/error/blocked/output-limit events count regardless of which application/window is foreground.

Example: A, B, C, D and E finish. Count = **5**. Focus DSH while A's older content is visible: **5**. Scroll A's newest result footer into view: **4**. B–E remain unread. Another result in B replaces B's revision without adding another session count. Viewing an older B turn cannot acknowledge that newer revision.

No OS-focus read inference, window-clear mode, compatibility fallback, DOM-title discovery, general session-open listener or client-reported blanket “clear all” operation exists.

## Official client → Host bridge

1. The official package client contribution registers a one-pixel measurement marker in the `conversation.chat.turnTail` list Slot. The footer exists only after Chat has materialized a real `turn/end`; it does not overwrite the Chat renderer or patch application sources.
2. Its standard hook reads the actual `turn/end.seq` from `uiConversation.binding(binding).target('chat').timeline`. The Slot's own `seq` may identify an earlier assistant message and is **not** accepted as end evidence.
3. `uiSession.current` must identify this main Session. The document must be visible and focused; IntersectionObserver must report the mounted footer in the viewport; own-marker geometry/visibility is checked again before sending. Merely opening/retaining a Session proves nothing. An unloaded/inactive/hidden result cannot acknowledge.
4. Through authenticated, lifecycle-scoped `connection.rpc`, the client reads just this Session's pending revision, verifies its kind/turn/end-seq, then sends `{ sessionId, revision, kind, turn, eventSeq }` to the read endpoint.
5. The Host checks owner access, input shape, cancellation, mount lifetime, random mount epoch and the exact current revision. Its synchronous compare-and-swap clears only that result. Client state never optimistically decrements the number.

Each new attention revision is unique within a mount; a random mount epoch rejects previous-Host receipts. Result replacement and read handling are synchronous. ACK-before-new-result leaves the new result unread; new-result-before-old-ACK rejects the old receipt. Duplicate/two-window ACKs clear one result once. Leaving/re-entering visibility aborts in-flight evidence; reconnect acquires new proof. The Host holds no sticky active-window lease capable of reading future events automatically.

## Waiting, cancellation and lifecycle

- With `notifyOnWaiting`, approvals/questions count until their actual decision/answer or owning operation ends. **There is no automatic view-only read receipt for these temporary composers**: the current SDK does not provide an equivalent exact rendered-question footer. The plugin deliberately does not guess from an active-session header or an open event.
- Terminal unread and temporary waiting are retained independently within one counted session. A new turn/wait and its resolution cannot erase an older unread result. Reading that older result leaves a live request counted.
- A new eligible terminal result supersedes the older result and retires waits from its turn. Aborts do not notify; they retire waiting while preserving an older unread result. Restored `interrupted`/`forked` history markers do not notify.
- By default, successful intermediate turns of an active goal do not notify. Goal completion and eligible failures still do; notification preferences do not serve as read-mode switches.
- A Host Session-store detach is object disposal, not proof of read/deletion: terminal unread and turn dedup survive; temporary waits retire and late events are rejected until a new valid turn starts.
- Page reload, disconnect and helper restart preserve Host-memory state. **Host restart, plugin reload/disable and crash do not persist it.** Historical logs are never replayed into unread. Deleted/unviewable historical sessions can remain pending until plugin reset; no durable deletion API is inferred from object teardown.

## Native display and limitations

The helper only draws the Host's aggregate count, even in the foreground. It never reads OS foreground focus. All visible windows whose complete executable path matches receive the same overlay; cleanup revalidates recorded handles, and topology/error recovery retries the desired total. No title matching or application identity rewriting. Different Host instances sharing one executable are not distinguished: do not run competing badge providers for them. Tray-hidden windows are not restored.

The automatic read contract currently covers **Chat** result footers. Other target views, an unavailable browser contribution/IntersectionObserver, or a footer never scrolled into view fail closed and retain unread. “Viewed” means the browser exposure conditions above, not eye-tracking or proof of human comprehension; OS-level occlusion not reported by document visibility cannot be proven. Fake tests establish state/bridge ordering, not all real-browser layout, shell/DPI or Explorer behavior. No synthetic preview is a native screenshot.
