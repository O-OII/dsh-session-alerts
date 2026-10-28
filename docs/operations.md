# Compatibility and safe operation

[README](../README.md) · [简体中文](operations.zh-CN.md)

## Requirements and compatibility boundary

| Component | Supported contract / verification boundary |
| --- | --- |
| DSH | `>=0.2.1-rc.2 <0.3.0`, official `subprocess`, `sessionProjections`, `connection`, `webServer` Host services (Connection RPC route registration reads the caller-scoped `webServer`) plus the official client Chat/Session/Conversation/Slot services. The tested precursor used Desktop 0.2.1-rc.2; the range is an API constraint, not a claim that every release was tested. |
| Windows | Interactive Windows 10/11 session with Explorer and a visible DSH taskbar button. The original implementation had maintainer-run Windows overlay/clear probes. **This portable release variant, removal of the helper AppUserModelID call and regenerated artwork still require fresh live Windows acceptance.** |
| Node | 22 or later; development tests use the experimental VM-module flag. |
| Python | Existing Python 3.10+ for Windows; official DSH primary runtime preferred. The installed runtime helper uses only the standard library. Artwork regeneration/tests use pinned development-only Pillow; no font file is required. No runtime download or installation. |
| Linux/macOS | Native plugin is inert. CI runs fake Node/Python tests; this is not native badge support. |
| Multiple DSH windows, tray-only apps, custom shells, small taskbar buttons, unusual DPI | Not claimed as live-validated. All exact-executable windows receive the same Host aggregate; Windows decides final placement/visibility. Independent Host instances sharing one executable are not distinguished. |

This repository contains no private deployment snapshots or screenshots. Fake tests cannot establish actual shell rendering, DPI readability, grouping behaviour or Explorer restart behaviour on every machine. The release-specific acceptance boundary is the matrix above, not any private deployment's historical status.

## Install from a local source checkout

Use **the official CLI shipped with the same DSH Desktop installation**, not an unrelated global CLI. Start PowerShell in this repository. Installation is a manual user action; tests never install, edit a live profile or manipulate the taskbar.

```powershell
$DshCli = Read-Host 'Full path to this DSH Desktop installation\resources\runtime\cli\bin\dsh.cmd'
$Project = (Resolve-Path .).Path
& $DshCli plugin --profile desktop add --ignore-scripts $Project
```

If your installation puts its official CLI elsewhere, select that exact shipped CLI. `--ignore-scripts` disables package lifecycle scripts for this operation, not any global security policy. The package has no dependencies or lifecycle installation scripts. It ships a deterministic official `./client` loader contribution; after an update refresh the existing page if it has not loaded the new bundle. Never start another server as a substitute for updating the existing page. The CLI may retain a local development link: keep the checkout in place. Do not enable the old local badge plugin and this plugin simultaneously; disable the old plugin first during a safe maintenance window.

Normal host reload/disposal is owned by DSH. If your plugin lifecycle queue is busy, wait or arrange a safe maintenance window; never kill unrelated agents or edit their integration packages to force activation. Package-manager changes can reify other packages: back up your own local customizations before install/remove.

## Durable updates: archives, locks and hard links

Build and test the source **before** packing. Put each fixed archive in a new immutable output path; do not overwrite a previously locked `.tgz`. Install that exact archive with the same official CLI and verify the saved dependency specification, lockfile integrity and the actual served client artifact agree. If using the independent sidecar, pack/update its corrected client too; an old sidecar archive can restore completed-only behavior even when local source says unread.

Do not fix only `node_modules/client.js` in place. A package manager can hard-link it to its content-addressed store: an in-place write can corrupt the cache, and a later integrity check/reinstall can restore old bytes into the live plugin. Never edit the shared store. If a separately authorized maintenance procedure needs to replace installed artifacts, stage verified bytes and atomically replace the directory entry rather than writing through the hard link; also persist the corrected archive and manifest/lock reference. This repository does not ship machine-specific live-profile repair scripts.

Refresh the existing GUI after artifact updates if it has not loaded the new revision. Do not treat a source edit, an old cached bundle or an engine's unchanged diagnostic version as proof of what the renderer loaded. Do not rerun live-profile package-manager operations merely to test a repair: use a disposable directory/profile and isolated store. If certificate, supply-chain or build-approval checks fail, stop and resolve the environment legitimately; do not relax global security policy.

## Troubleshoot safely

- **`configuration-error`:** supply the exact existing desktop executable and trusted Python 3.10+ executable. There is no automatic Python installation; do not point Python to Electron/node.
- **No visible number:** make sure the application has an actual taskbar button and Windows allows badges/overlays. A hidden tray-only app is not restored. Foreground focus alone does not clear unread. The official client must load: either a qualified current native-read main view or an exact visible Chat result footer can acknowledge one terminal revision. See the [two read paths](behavior.md). Small-button mode and shell policy may suppress overlays.
- **Multiple DSH windows:** each matching window displays the same aggregate; reading a result in either eligible window acknowledges only that session revision, once. There is no title guessing or per-window count.
- **Helper error/readiness timeout:** check selected Python, Windows session/Explorer access and security policy. The helper starts with `-I -u`. Plugin-owned errors and native HRESULT wrappers default/fall back to Simplified Chinese; underlying operating-system messages may remain in the OS language.
- **Crash/Explorer recreation:** unexpected helper exit is retried at most three times (1/2/4 seconds). A changed Explorer/window topology or failed draw retries the current desired overlay; it does not generate new session notifications. After retry exhaustion, fix the cause and disable/re-enable the plugin.
- Optional diagnostics are written beside the plugin as `runtime-status.json`; read-only installs may log a warning but counting does not depend on this file. It contains phase, process IDs, native handles/counts and error text, not conversation content. Error text can still reveal local paths: redact it before sharing. Never submit a full profile or private snapshot.

## Disable, uninstall and roll back

1. Prefer disabling **Native taskbar number badge** in DSH's plugin manager, or set `enabled: false`. Normal disposal sends quit/EOF, clears its overlay, waits for the helper, then applies a bounded forced termination only to its own helper if necessary.
2. To remove the package, use the same official CLI after disabling it:

   ```powershell
   & $DshCli plugin --profile desktop remove --ignore-scripts dsh-native-taskbar-badge
   ```

3. To roll back an update, disable this plugin, restore a known-good checkout/release, install that local directory with the same command, and re-enable only after checking paths. Keep any unrelated plugin customizations backed up; do not downgrade DSH or kill applications for a demonstration.
4. No shortcut, AppUserModelID, protocol, registry or startup entry was created, so none needs reversal. Remove the old local checkout and its optional diagnostic file only after its helper has exited. If a hard Host/OS crash leaves a stale shell image, safely reopen your own DSH window or use Windows' normal shell recovery later; abrupt process termination cannot guarantee normal cleanup.
