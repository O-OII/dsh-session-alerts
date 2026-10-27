# Development and verification

[README](../README.md) · [简体中文](verification.zh-CN.md)

## Reproduce offline

```powershell
npm run build
npm test
npm run test:python
npm run test:pack
```

The runtime has no third-party Python/font dependency. Asset regeneration and Python asset tests use pinned development-only Pillow: provision `python -m pip install -r tools/requirements-assets.txt`, then test offline. Build deterministically wraps the authored client and receipt driver in the official lazy loader factory; `npm test` first checks that the shipped bundle matches those sources. Packaging uses an existing npm with `pack --ignore-scripts --offline`; archives, cache and unpacked verification stay in ignored `artifacts/`. There are no npm runtime dependencies; the separate artwork requirements file pins the development renderer.

## 0.2.2 artwork verification

Local Windows checks passed **129 JavaScript + 43 Python + 3 offline package tests**, with no failures/skips. The five asset tests cover all 100 five-frame ICO containers; original-path deterministic regeneration; transparent corners and antialiased edges; opaque white/dark contrast; actual 32/64→16 reductions; and absence of Pillow/font imports in the runtime helper. Regenerating all 100 icons again produced identical SHA-256 values. The native helper, unread state, client/RPC and lifecycle implementations are unchanged; only package/diagnostic version metadata advances.

Separately performed native probes of 1/5/4/12/99+ returned COM success and were visually reviewed. Current README captures are 132 × 48-pixel crops; no fixed count of surrounding taskbar icons is implied. These probes are rendering evidence, not model-task or all-DPI/end-to-end acknowledgement acceptance. CI provisioning was updated for development-only Pillow; no remote CI run, deployment or paid call was performed by these local tests.

## 0.2.1 local evidence

On Windows, Node **22.22.3**, Python **3.10.8**, the redesign's isolated run passed **129 JavaScript + 40 Python + 3 real offline packaging tests**, no failures/skips. Tests use fake Host services, browser/React/Slot/IntersectionObserver adapters, native helper pipes and Win32/COM; **no live profile, installed package, native taskbar, server restart or paid model call is used**. The separate offline packaging suite validates the real archive and unpacked runtime; rerun it after any release-file change.

Coverage includes:

- Five unread sessions → one newest active/visible result exposed → four remain; foreground A does not acknowledge B.
- Exact `turn/end.seq` rather than earlier assistant-message sequence; old-turn views never clear newer results.
- Both ACK/event race orderings, mount epochs, duplicate/two-window receipts and per-session deduplication.
- In-flight hide/blur/session-switch/disconnect/stop cancellation, reconnect/page remount, transport retry without optimistic decrement, and cleanup of observers/listeners/timers.
- Terminal unread independent of temporary waits; waiting resolution/new turns/object detach cannot discard unread results; subagent origin/depth filtering, abort/history/goal policies.
- Native foreground suppression absent, aggregate count across matching windows, full-executable filtering, resource cleanup, bounded helper restart and topology/draw retries.
- Chinese-default/English/explicit-auto fallback, path configuration failures, 100 original ICOs and package privacy exclusions.

The SDK contracts were inspected in read-only snapshots of the shipped official packages, including client modules, Connection, Session, UI Session, Conversation and Chat. No SDK or application installation source was changed. Built-in `completionUnread` was rejected as a read authority because it uses main-view retention without visibility/revision proof.

## Official SDK route-registration regression

The complete official Cordis service proxy can evaluate Connection's `rpc` getter with a provider-shadow Context: consumer `webServer` injection alone is insufficient. Production code now uses public `ctx.extend({ webServer: ctx.webServer })` with the already-authorized service value and explicitly owns the route disposer. The contract suite imports **complete Cordis 4.0.5 and the complete Connection rc.3 class**, including its real constructor, Service proxy and getter, from an extracted read-only dependency closure. No SDK install/modification, provider mutation, private-symbol access or live server is used. The earlier raw-register-only check did not cover this ownership issue and is not deployment evidence.

```powershell
$env:DSH_BADGE_SDK_ROOT = Read-Host 'Absolute path to extracted official node_modules dependency closure'
node --test tools/host-sdk-contract.test.mjs
npm test
```

The three full-framework regressions passed: the old direct getter call fails even with consumer injection; production registration works and its actual route handler still rejects an unauthenticated request with HTTP 401; route ownership is released across restart/disable/re-enable while the Connection provider stays active. The ordinary 129 JavaScript tests also pass with declaration guards. This verifies real framework ownership and registration against a fake WebServer registry, not a live HTTP/native deployment.

## Limits of this evidence

Fake browser adapters do not constitute real-browser layout/occlusion acceptance; simulated COM does not establish actual taskbar drawing, DPI, shell grouping or Explorer behavior. [CI](../.github/workflows/test.yml) runs fake logic on Windows and Ubuntu; a successful Windows runner is not a native screenshot. Host restart persistence, view-only read of pending questions and non-Chat auto-acknowledgement are not implemented. See [behavior](behavior.md) and [image provenance](images.md).

Any separately captured native screenshots must clearly distinguish real shell pixels from controlled input counts. A screenshot of a probe value proves rendering, **not** that five real sessions ran or that a real client acknowledgement caused the transition. Never label illustrations as native captures.
