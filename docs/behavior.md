# Counting and acknowledgement

[README](../README.md) · [简体中文](behavior.zh-CN.md)

## What the number means

- While DSH is in the background, count each main session **once** if it finishes, fails, becomes blocked, reaches its output limit, waits for approval or runs `ask_user_question`.
- Display `1` through `99`, then `99+`. Subagents never add counts.
- Focusing **any window belonging to the exact configured DSH executable** acknowledges and clears all pending sessions. Leaving DSH again does not replay old events.
- **This is window-level acknowledgement, not per-session unread tracking.** If DSH is foreground, another session finishing does not accumulate an unread badge. State is in memory; restarting does not replay history.
- User cancellation and restored-history markers do not notify. Completed intermediate rounds of an active goal are filtered by default; final completion and failures remain eligible.
- Matching uses the full executable path, never fuzzy window titles. More than one visible matching top-level window is ambiguous: the helper refuses to guess. It does not restore tray-hidden windows.

There is no custom GUI. Settings have English/Chinese metadata. Simplified Chinese is the default and fallback for diagnostics, accessibility descriptions and generic settings metadata; explicit English remains available. No synthetic icon collage is presented as a desktop screenshot.
