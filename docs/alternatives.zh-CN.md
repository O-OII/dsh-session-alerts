# 技术方案与同类比较

[README](../README.zh-CN.md) · [English](alternatives.md)

## 与类似方案的区别

| 方案 | 用途和区别 |
| --- | --- |
| 本插件 / [Windows `ITaskbarList3` overlay](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-itaskbarlist3-setoverlayicon) | 安静地在已有 DSH 任务栏按钮上叠加数字，不改应用身份、不改安装包。 |
| [Electron `BrowserWindow.setOverlayIcon`](https://www.electronjs.org/docs/latest/api/browser-window#winsetoverlayiconoverlay-description-windows) | 用于掌控自身 Electron 主进程的应用。本插件改用外部 helper，不修改桌面包内的主进程。 |
| [dsh-badge-notify](https://github.com/dthcle/dsh-badge-notify) | 直接数字角标同类，使用 UIA 定位与透明浮层，本项目改用原生 COM 与官方客户端精确结果版本确认。 |
| [Muyu97/dsh-taskbar-badge](https://github.com/Muyu97/dsh-taskbar-badge) | 直接 1…99+ / 回窗清零同类，通过 ASAR 补丁接入 Electron；本项目不改安装文件。 |
| [SnoreToast](https://github.com/KDE/snoretoast) | 发送 Windows 桌面 Toast，而不是本项目按主会话去重的数字角标；本项目不打包或调用它。 |
| [Web Badging API](https://developer.mozilla.org/en-US/docs/Web/API/Badging_API) | 浏览器/PWA 的应用角标，兼容条件与应用身份不同于已有原生 DSH 窗口。 |

链接仅供技术比较，不代表复制代码或获得对方背书。
