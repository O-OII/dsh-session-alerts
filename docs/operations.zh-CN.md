# 兼容性与安全操作

[README](../README.zh-CN.md) · [English](operations.md)

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

## 故障排查

- **`configuration-error`：**设置精确桌面 exe 及可信 Python 3.10+；插件不自动安装 Python，不要选 Electron/node。
- **有计数却不可见：**确认实际存在任务栏按钮，Windows 允许显示角标。仅托盘窗口不会被恢复；前台清零是设计行为，小按钮模式和策略也可能隐藏覆盖图标。
- **多个 DSH 窗口：**在安全时机自行关闭不需要的额外窗口，或停用插件；不会按标题猜测，也无逐窗口选择器。
- **helper 报错/就绪超时：**检查 Python、交互用户会话、Explorer 及安全策略。启动带 `-I -u`；插件自有错误及 HRESULT 包装默认并回退简体中文，底层系统或标准库错误可保留原语言。
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
