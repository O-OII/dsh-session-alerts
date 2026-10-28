# DSH Session Alerts

[简体中文](./README.zh-CN.md) · [MIT](./LICENSE)

**DSH Session Alerts / DSH会话提醒** adds a **completed-main-session workspace view** and quiet **per-session unread** Windows taskbar badges to DeepSeek Harness Desktop.

The technical npm package, settings namespace and contribution IDs remain `dsh-native-taskbar-badge`; this product rename does not migrate or reset settings/unread state.

**0.2.2 artwork:** original rounded Bezier numerals, dark circular/capsule backgrounds and transparent antialiased edges. Each ICO includes 16/24/32/48/64 px artwork; no system or bundled font is used. The verified unread/RPC behavior is unchanged.

## One session, one count — read one, subtract one

- **Quiet:** no toast, sound, focus stealing, ASAR patch or application-identity changes.
- **Deduplicated:** each main session counts once, even with repeated completion/error events or several input requests. Subagents are excluded.
- **Actually viewed:** a result is acknowledged only when its official Chat result footer is rendered in the active main session, intersects the viewport, and the page is visible and focused.
- **Revision-safe:** the client sends the exact session, turn, turn-end event sequence and Host-issued revision. A delayed read cannot clear a newer result.
- **Foreground counts too:** while you view A, a result in B still adds one. With five unread sessions, viewing one newest result changes **5 → 4**, never 5 → 0.

There is **no window-clear mode, old-mode switch or compatibility acknowledgement path**. Merely focusing DSH, opening a session, viewing an older turn, reconnecting or refreshing the page does not clear unrelated unread results.

### Real Windows taskbar captures — controlled native probes

| Native probe value: 5 | Native probe value: 4 |
| --- | --- |
| ![Real Windows taskbar showing the DSH native badge 5](docs/images/native-badge-5.png) | ![Real Windows taskbar showing the DSH native badge 4](docs/images/native-badge-4.png) |

*Actual 132 × 48-pixel taskbar-region captures with DSH in the foreground. The native helper received controlled probe values 5 and 4 on the same DSH window; both COM calls returned success (`HRESULT 0`). These prove native shell rendering, not five real model tasks or an end-to-end client read-acknowledgement transition. The 5 → 4 unread-state behavior is verified separately by isolated integration tests.*

<details>
<summary>Historical 0.2.1 block-digit comparison — not the current 0.2.2 artwork or a desktop screenshot</summary>

![Bundled geometric ICO artwork on light and dark surfaces](docs/images/badge-assets-en.png)

</details>

## What the number means

Eligible live main-session results: completion, error, blocked and output-limit endings. With `notifyOnWaiting`, unresolved approval/question requests also keep their session counted until answered or decided; **view-only acknowledgement of pending questions is not implemented**. Reading an older result never resolves a pending request, and resolving a request never discards an unread result. Display is `1`–`99`, then `99+`.

Cancellation and restored history do not create notifications. Intermediate successful rounds of an active goal are filtered by default. Unread state lives in Host memory: it survives browser/window disconnect, page refresh and helper restart, **not Host restart or plugin disable/re-enable**. No history replay or persistent-unread claim. See [behavior and limitations](docs/behavior.md).

## Completed-session workspace view

| Completed-only off | Completed-only on |
| --- | --- |
| ![Real workspace toolbar with completed-only off](docs/images/session-filter-off-live.png) | ![Real workspace toolbar with completed-only on, blue check-circle](docs/images/session-filter-on-live.png) |

*Actual 260 × 36-pixel workspace-toolbar captures, without session rows/private content. The check-circle sits to the right of Search and left of View options; blue indicates on. These are the real filter controls, separate from the taskbar-number probe screenshots above.*

Click the check-circle button in the **workspace section's right-hand header actions**, beside the native search/view/add controls. Click again to restore all session states. The pressed state, accessible name and tooltip are explicit. The toggle is page-local and changes **only this filter**: it does not archive/delete sessions, write session metadata, acknowledge unread results, clear search, change grouping/order, or reset other filters.

“Completed” means the latest **consumed DSH work** ended successfully, not that a real-world business objective was independently verified. Empty/no-op turns do not invent success. Running, waiting, unsuccessful/cancelled endings, active/paused/blocked goal rounds, subagents and unknown baselines are excluded. Goal clearing cannot turn an old intermediate round into success. Confirmed running descendant subagents also exclude their associated main parent. An unassociated orphan does not contaminate unrelated main sessions; the view does not claim it can prove every external/unknown descendant. Previously read successful results remain eligible. Loading/unknown/empty states explain what is happening and offer a recovery that disables only completed-only.

This feature requires **workspace extension API v1**, not supplied by stock rc.3. The isolated, user-authorized [workspace SDK compatibility project](compat/workspace-sdk/README.md) provides genuine header/status slots and composable set filters on a SHA-256-pinned rc.3 baseline; it is not an upstream release and is deliberately excluded from the main npm archive. No DOM hiding, title-based inference, ASAR editing or replacement application server is used. Missing API fails closed with an unavailable diagnostic and no fake header toggle.

Completion is a separate read-only Host projection and the sidebar has no Python/Windows requirement. [Detailed semantics and composition](docs/completed-filter.md). To add this view beside an already-running older badge engine **without reloading/resetting its unread count**, use the independently built [completion + sidebar sidecar](sidebar-package/package.json), not a file-URL Loader entry under this repository's root package. Do not enable the sidecar alongside the full 0.3.0 client: they intentionally provide the same filter ID.

## Requirements

**Native badge:** Windows 10/11, Explorer and a visible DSH taskbar button; trusted Windows **Python 3.10+**. **Sidebar:** workspace extension API v1 plus the independent completion projection; no Python/Windows requirement. **Node 22+**; DSH **`>=0.2.1-rc.2 <0.3.0`** with official `subprocess`, `sessionProjections`, `connection`, `webServer` and the client Chat/Session/Conversation/Slot services. The package includes its official browser contribution. Other conversation targets do not auto-acknowledge results. See [compatibility](docs/operations.md).

## Install from source

Use the official CLI from **your current Desktop installation**. This is a manual installation step; repository tests do not change your live profile.

```powershell
$DshCli = Read-Host 'Full path to resources\runtime\cli\bin\dsh.cmd in your DSH installation'
$Project = (Resolve-Path .).Path
& $DshCli plugin --profile desktop add --ignore-scripts $Project
```

Keep the checkout if the CLI creates a local link. Disable any other badge provider before enabling this one. After installing/updating the browser contribution, refresh your existing DSH page if it has not loaded the new contribution. [Operations and rollback](docs/operations.md).

## Settings and development

**Simplified Chinese is the default and fallback.** Use `language: en` for English; only explicit `auto` follows environment language. Set exact `desktopExecutable` and trusted `pythonPath` if discovery cannot find them. [Configuration](docs/configuration.md).

```powershell
npm run build
npm test
npm run test:python
npm run test:pack
```

The installed plugin has no Pillow/font dependency. Artwork regeneration and the Python asset tests need the development-only dependency provisioned with `python -m pip install -r tools/requirements-assets.txt`; after provisioning they run offline. No paid model calls, live profile edits or native taskbar access are used by tests. [Test evidence and limitations](docs/verification.md) · [Images](docs/images.md) · [Alternatives](docs/alternatives.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Asset provenance](ASSET-PROVENANCE.md).

## License

[MIT © 2026 O-OII contributors](./LICENSE).
