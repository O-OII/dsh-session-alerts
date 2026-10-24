# DSH 原生任务栏数字角标

[English](./README.md) · [MIT 许可](./LICENSE) · [参与开发](./CONTRIBUTING.md) · [安全说明](./SECURITY.md)

用于 DeepSeek Harness Desktop 的 **Windows 原生数字覆盖角标**。独立 Host 插件观察主会话实时事件，使用 Python 标准库辅助进程调用 COM `ITaskbarList3.SetOverlayIcon`。**不修改 ASAR、不发 Toast、不响铃、不抢焦点，不改快捷方式、AppUserModelID 或系统协议。**

GitHub 目标：<https://github.com/O-OII/dsh-native-taskbar-badge>。可独立安装，不依赖注释或活动面板项目；以 GitHub 源码分发为目标，无需 npm 发布。

![实际附带的无字体数字资产示意](docs/images/badge-assets-zh.png)

*资产示意，不是真实 Windows 桌面截图。可打开 `tools/preview-assets.html?lang=zh` 查看实际附带的 ICO 图标。*

## 数字表示什么

- DSH 在后台时，主会话完成、失败、被阻塞、输出超限、等待审批或执行 `ask_user_question` 时计入；同一主会话无论多少提醒只计 **1**。
- 显示 `1`～`99`，超过 99 为 `99+`；子代理不计。
- 切回**属于配置中精确 exe 的任意窗口**即确认并清除全部待查看计数；再次离开不重放旧事件。
- **这是窗口级确认，不是逐会话未读系统。** DSH 位于前台时，其他会话完成也不积累计数；状态只保存在内存中，重启不补发历史提醒。
- 用户取消、历史恢复标记不提醒。默认过滤活动目标仍在自动推进的已完成中间回合；最终完成及失败仍可计数。
- 校验进程完整可执行文件路径，不模糊匹配标题。若多个可见顶层窗口属于同一匹配 exe，拒绝猜测；不会恢复隐藏到托盘的应用。

没有自定义 GUI；国际化以中英文设置元数据、诊断和文档为主。不把测试小图标拼贴当作真实桌面截图。

## 与类似方案的区别

| 方案 | 用途和区别 |
| --- | --- |
| 本插件 / [Windows `ITaskbarList3` overlay](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-itaskbarlist3-setoverlayicon) | 安静地在已有 DSH 任务栏按钮上叠加数字，不改应用身份、不改安装包。 |
| [Electron `BrowserWindow.setOverlayIcon`](https://www.electronjs.org/docs/latest/api/browser-window#winsetoverlayiconoverlay-description-windows) | 用于掌控自身 Electron 主进程的应用。本插件改用外部 helper，不修改桌面包内的主进程。 |
| [dsh-badge-notify](https://github.com/dthcle/dsh-badge-notify) | 直接数字角标同类，使用 UIA 定位与透明浮层，逐会话已读语义不同于本项目的窗口级确认。 |
| [Muyu97/dsh-taskbar-badge](https://github.com/Muyu97/dsh-taskbar-badge) | 直接 1…99+ / 回窗清零同类，通过 ASAR 补丁接入 Electron；本项目不改安装文件。 |
| [SnoreToast](https://github.com/KDE/snoretoast) | 发送 Windows 桌面 Toast，而不是本项目按主会话去重的数字角标；本项目不打包或调用它。 |
| [Web Badging API](https://developer.mozilla.org/en-US/docs/Web/API/Badging_API) | 浏览器/PWA 的应用角标，兼容条件与应用身份不同于已有原生 DSH 窗口。 |

链接仅供技术比较，不代表复制代码或获得对方背书。

## 兼容矩阵与真实验证边界

| 组件 | 契约 / 验证边界 |
| --- | --- |
| DSH | `>=0.2.1-rc.2 <0.3.0`，需要官方 `subprocess`、`sessionProjections` Host 服务。前身在 Desktop 0.2.1-rc.2 验证过；此范围是 API 约束，不表示每版均实测。 |
| Windows | 带 Explorer 的 Windows 10/11 交互用户会话，有可见 DSH 任务栏按钮。前身有维护者执行的真实覆盖/清除探测；**本次便携开源副本、移除 helper 的 AppUserModelID 调用及重新生成图标后，仍需新一轮真实 Windows 验收。** |
| Node | 22 及以上；开发测试需要实验性 VM modules 开关。 |
| Python | 已有 Windows Python 3.10+，优先官方 DSH 主运行时；helper 和图标生成均仅用标准库，不下载、不安装运行时。 |
| Linux / macOS | 插件原生功能不启动。CI fake 测试不等于支持原生角标。 |
| 多窗口、仅托盘、自定义 shell、小任务栏按钮、特殊 DPI | 不声称完成真实验证。多个匹配的可见窗口拒绝操作；最终位置和可见性由 Windows 控制。 |

此仓库不包含私密部署快照或截图。fake 测试不能证明真实 shell 绘制、DPI 可读性、分组效果及各机器 Explorer 重启后的表现；本发布的验收边界以上表为准，不以个人部署历史状态作保证。

## 从本地源码安装

使用**与当前 DSH Desktop 同一安装目录自带的官方 CLI**，不要误用另一个全局 CLI。在本仓库目录打开 PowerShell：

```powershell
$DshCli = Read-Host '本次 DSH Desktop 安装目录中 resources\runtime\cli\bin\dsh.cmd 的完整路径'
$Project = (Resolve-Path .).Path
& $DshCli plugin --profile desktop add --ignore-scripts $Project
```

若官方 CLI 位于其他目录，选择该安装实际携带的 CLI。安装是用户手动操作；测试不安装插件、不修改现用 profile、不操作任务栏。`--ignore-scripts` 只禁用此次包生命周期脚本，不改变全局安全策略；本包无 npm 依赖或安装脚本。CLI 可能保留本地开发链接，请保留源码目录。

不要同时启用旧本地角标插件和本插件；请在安全维护窗口先停用旧插件。正常重载/卸载由 DSH 管理；若已有生命周期队列忙碌，应等待或另约维护窗口，不能为演示强杀其他代理或修改其集成。包管理器重整可能影响其他包，操作前备份自己维护的本地定制。

## 跨机器 Windows 路径配置

独立[安装 patch](./cordis.patch.yml)不含个人绝对路径。默认留空表示有边界的发现，不表示猜窗口。

| 设置 | 默认 | 含义 |
| --- | --- | --- |
| `enabled` | `true` | 启动 helper；停用时清理进程及其最后设置的覆盖图标。 |
| `desktopExecutable` | 空 | 精确 DSH 桌面 exe 的现有 Windows 绝对路径，不是 `dsh.cmd`、node 或 Python。 |
| `pythonPath` | 空 | 已有 Python 3.10+ `python.exe` 的 Windows 绝对路径；接受带版本数字的 Python 文件名，不接受 `pythonw.exe`。 |
| `notifyOnError` | `true` | 计入失败、阻塞及输出超限。 |
| `notifyOnWaiting` | `true` | 计入待审批与 `ask_user_question`。 |
| `notifyOnGoalRounds` | `false` | 是否计入活动目标自动推进的已完成中间回合。 |
| `language` | `auto` | 诊断及可访问性描述支持 `en`、`zh`；auto 按 `LC_ALL`、`LC_MESSAGES`、`LANG` 选择，否则回退英文。设置元数据独立跟随宿主界面语言。 |

发现顺序：

1. 桌面：非空设置 → 显式提供的 `DSH_DESKTOP_EXECUTABLE` → 当前宿主 exe（**仅当文件名为 `DeepSeek Harness.exe`**）→ 已知 `resources/app.asar/dsh/` Host 入口对应安装根目录下的 `DeepSeek Harness.exe`。
2. Python：非空设置 → 显式提供的 `DSH_PYTHON_PATH` → `$env:DSH_HOME\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe` → `<桌面安装目录>\resources\runtime\python\python.exe`（若确实存在）。

不搜索 `PATH`、不扫描用户私目录、不查注册表、不装依赖；**绝不把 Electron 的 `process.execPath` 当作 Python**。显式值无效时直接关闭该能力，不默默改用其他程序。必须是文件，不能是目录。Python 的真实身份/版本最终依赖用户选择的可信程序，不要把任意程序改名为 `python.exe`。

无法确定两项路径时不启动 helper，请在插件设置中填本机实际存在的路径，例如 `C:/Applications/DSH/DeepSeek Harness.exe`、`C:/Runtimes/Python/python.exe`，这些仅是格式示例。支持盘符绝对路径和 UNC Windows 路径；不支持 POSIX 或 `C:...` 盘符相对路径。建议本地可信程序而非网络共享。环境变量需在 Host 启动前提供，后来修改某个 shell 的变量不会改变已运行 Host。

## 故障排查

- **`configuration-error`：**设置精确桌面 exe 及可信 Python 3.10+；插件不自动安装 Python，不要选 Electron/node。
- **有计数却不可见：**确认实际存在任务栏按钮，Windows 允许显示角标。仅托盘窗口不会被恢复；前台清零是设计行为，小按钮模式和策略也可能隐藏覆盖图标。
- **多个 DSH 窗口：**在安全时机自行关闭不需要的额外窗口，或停用插件；不会按标题猜测，也无逐窗口选择器。
- **helper 报错/就绪超时：**检查 Python、交互用户会话、Explorer 及安全策略。启动带 `-I -u`；错误有英文通用回退，底层系统错误可保留系统语言。
- **helper 崩溃/Explorer 重建：**意外退出最多按 1/2/4 秒重试三次；Explorer/窗口拓扑改变后重施仍待查看的覆盖图标，不生成新会话提醒。重试耗尽后修复原因，再停用/启用插件。
- 插件旁可选诊断文件为 `runtime-status.json`；只读安装位置可能警告，但计数不依赖写成功。内容为状态、PID、窗口句柄/计数、错误文本，不保存会话正文。错误仍可能含本机路径，分享前脱敏，不要上传完整 profile 或私密快照。

## 停用、卸载、回滚

1. 优先在 DSH 插件页关闭“原生任务栏数字角标”，或设置 `enabled: false`。正常卸载发送 quit/EOF，清除覆盖图标并等待退出；超时只对自己创建的 helper 做有界终止。
2. 停用后若需移除，用同一官方 CLI：

   ```powershell
   & $DshCli plugin --profile desktop remove --ignore-scripts dsh-native-taskbar-badge
   ```

3. 回滚更新：先停用，恢复已知可用的源码/发布版本，再以相同本地安装命令安装；检查路径后启用。不为演示降级 DSH、杀应用或覆盖其他插件定制。
4. 本插件没创建快捷方式、AppUserModelID、协议、注册表或自启动项，无这些系统残留需回滚。确认 helper 退出后才移除旧源码及可选诊断文件。若 Host/系统硬崩溃留下 shell 残影，在安全时机正常重新打开自己的 DSH 窗口或通过 Windows 常规方式恢复 shell；异常强杀无法保证正常清理。

## 离线 fake 开发测试

```powershell
node --experimental-vm-modules --test test/*.test.mjs
python -B -m unittest discover -s test -p 'test_*.py' -v
python -B tools/generate-assets.py
```

无需 npm/pip 安装。保留五项基础测试套件（63 JavaScript + 29 Python），新增路径发现、字段/locale 完整性、原生跨平台及配置安全失败测试。本次在 Windows、Node 24.21.0 / Python 3.12.14 实跑 **87 JavaScript + 35 Python，全部通过，无跳过**。还通过隔离官方 Desktop SDK 导入，核验七个字段的中英文元数据及英文回退，并确认有边界发现桌面/Python 程序；未 apply 插件、未启动 helper、未读取 profile。Host 测试在 Linux 也模拟 Windows；所有子进程和窗口行为均为 fake。[CI](./.github/workflows/test.yml) 在 Ubuntu 与 Windows 上执行相同 fake 测试，绝不直接运行真实 helper。**Windows runner 测试成功不代表真实 Windows 任务栏验收。**截图制作/隐私边界见[贡献指南](./CONTRIBUTING.md)。

## 许可与资产来源

[MIT © 2026 O-OII contributors](./LICENSE)。审查基于提供的本地运行源码，不凭包名推断所有权。[资产来源说明](./ASSET-PROVENANCE.md)记录独立审查的 SVG 及新生成的无字体几何数字；不分发 Microsoft 字体文件或旧字体渲染图标。Windows 接口名称、GUID 和比较链接是接口引用，不是复制第三方实现库。
