# Approaches and alternatives

[README](../README.md) · [简体中文](alternatives.zh-CN.md)

## Compare the approaches

| Approach | Purpose and difference |
| --- | --- |
| This plugin / [Windows `ITaskbarList3` overlay](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-itaskbarlist3-setoverlayicon) | Quiet number on an existing DSH taskbar button; no app identity rewrites or source-package modification. |
| [Electron `BrowserWindow.setOverlayIcon`](https://www.electronjs.org/docs/latest/api/browser-window#winsetoverlayiconoverlay-description-windows) | Similar Windows overlay primitive for applications controlling their own Electron main process. This plugin instead uses an external helper and leaves the packaged application untouched. |
| [dsh-badge-notify](https://github.com/dthcle/dsh-badge-notify) | A direct numeric-badge alternative using UIA positioning and a transparent taskbar overlay; per-session unread acknowledgement differs from this window-level policy. |
| [Muyu97/dsh-taskbar-badge](https://github.com/Muyu97/dsh-taskbar-badge) | A direct 1…99+ / focus-clear alternative that patches ASAR to access Electron main-process overlay APIs; this project leaves installation files untouched. |
| [SnoreToast](https://github.com/KDE/snoretoast) | Desktop toast notifications, not this deduplicated session-count overlay. This project neither embeds nor invokes it. |
| [Web Badging API](https://developer.mozilla.org/en-US/docs/Web/API/Badging_API) | Browser/PWA app badges; availability and app identity differ from an existing native DSH desktop window. |

Links are comparisons, not bundled code or endorsements.
