# DSH会话提醒

[English](./README.md) · [MIT 许可](./LICENSE)

**DSH会话提醒 / DSH Session Alerts** 为 DeepSeek Harness Desktop 提供**只看已完成主会话的工作区视图**，以及呈现**逐会话未读**的安静 Windows 任务栏角标。

技术 npm 包名、设置命名空间和贡献 ID 继续使用 `dsh-native-taskbar-badge`；产品改名不迁移或重置设置/未读状态。

**0.2.2 新样式：**原创圆润贝塞尔数字，深色圆形/胶囊底、透明抗锯齿外缘；每个 ICO 含 16/24/32/48/64 像素资产，不使用系统字体或附带字体。已验收的未读/RPC 行为不变。

## 一个会话只计一次，查看一个只减一

- **安静：**不弹窗、不响铃、不抢焦点，不修改 ASAR 或应用身份。
- **按主会话去重：**重复完成/出错事件及多个待处理请求不会重复加数，子代理不计。
- **真正查看才确认：**只有当前主会话的官方 Chat 结果页脚已经渲染、进入视口，且页面可见并有焦点，才发送已读确认。
- **精确版本校验：**客户端携带会话 ID、轮次、轮末事件序号和 Host 签发的未读版本；延迟确认不能清除更新的结果。
- **前台仍累计：**正在查看 A 时 B 完成，B 仍加一。五个未读会话中查看一个最新结果，数字为 **5 → 4**，不会 5 → 0。

**没有窗口清零模式、旧模式开关或兼容确认路径。** 仅切回 DSH、打开会话、查看旧轮次、重连或刷新页面，都不会清掉其他未读结果。

### Windows 真实任务栏截图——受控原生探测

| 原生探测值：5 | 原生探测值：4 |
| --- | --- |
| ![Windows 真实任务栏上 DSH 原生角标显示 5](docs/images/native-badge-5.png) | ![Windows 真实任务栏上 DSH 原生角标显示 4](docs/images/native-badge-4.png) |

*上图为 DSH 位于前台时实际捕获的 132 × 48 像素任务栏区域。同一 DSH 窗口接收原生 helper 的受控探测值 5 和 4，两次 COM 调用均成功（`HRESULT 0`）。它们证明真实 shell 绘制，不代表运行了五个真实模型任务，也不代表客户端已读确认全链路验收；5 → 4 未读状态逻辑另由隔离集成测试验证。*

<details>
<summary>历史 0.2.1 块状字对照——不是当前 0.2.2 资产，也不是桌面截图</summary>

![附带的几何数字 ICO 在浅色和深色底上的资产预览](docs/images/badge-assets-zh.png)

</details>

## 数字表示什么

主会话的实时完成、出错、阻塞、输出超限结果均可计入。启用 `notifyOnWaiting` 时，未解决的审批/问题也使该会话保留计数，直到实际回答或决定；**目前没有“仅查看待回答问题即已读”的确认接口**。查看旧结果不会替你解决请求，解决请求也不会丢掉未读结果。显示 `1`～`99`，超过 99 为 `99+`。

用户取消和历史恢复不新增提醒；默认过滤活动目标成功的中间回合。状态保存在 Host 内存中，能跨浏览器/窗口断线、页面刷新和 helper 重启保留，**不跨 Host 重启或插件停用/重启用保留**，不重放历史，也不承诺持久未读。详见[行为与限制](docs/behavior.zh-CN.md)。

## 工作区“只看已完成”视图

| 只看已完成：关闭 | 只看已完成：开启 |
| --- | --- |
| ![真实工作区工具栏，完成筛选关闭](docs/images/session-filter-off-live.png) | ![真实工作区工具栏，完成筛选开启且勾选为蓝色](docs/images/session-filter-on-live.png) |

*上图为实际捕获的260×36像素工作区工具栏，不含会话行/私密内容。圆圈勾选位于搜索右侧、视图选项左侧，蓝色表示开启。这是实机筛选控件，与上方任务栏数字探测截图分开说明。*

点击**工作区标题栏右侧、原搜索/视图/新建控件旁**的圆圈勾选按钮，只看已完成主会话；再点恢复全部会话状态。按钮有明确按下态、可访问名称和提示。开关仅保存在本页内存，**只改变本筛选**：不归档/删除，不写会话元数据，不确认未读，不清搜索，不改分组/排序，也不重置其他筛选。

“已完成”指最新一笔**DSH实际消费的工作以成功终态结束**，不代表自动验收了现实业务目标。空claim/no-op不会凭空判成功；运行中、等待、异常/取消、活动/暂停/阻塞目标轮次、子代理和状态未知均不显示。清除目标不会把旧中间回合洗成成功；能可靠关联到运行中后代子代理的主会话也排除；无法归属的孤儿不会污染其他主会话，本视图不冒称可证明所有未知/外部后代。已经读过的成功结果仍可显示。加载/未知/空态会说明原因，恢复按钮只关闭“只看已完成”。

此功能需要**工作区扩展API v1**，stock rc.3不自带。本仓库隔离且经用户授权的[工作区SDK兼容工程](compat/workspace-sdk/README.md)基于SHA-256固定的rc.3源包，提供真实标题栏/状态槽及可组合集合筛选；它不是上游正式发布，也刻意不打入主npm包。不通过DOM隐藏、标题猜状态、ASAR修改或另起应用服务器实现。缺API时保守报告不可用，不放假按钮。

完成判定是独立只读Host投影，侧栏不依赖Python或Windows。[语义和组成分详解](docs/completed-filter.zh-CN.md)。若要在现有旧角标引擎旁新增侧栏、**不重载或清掉其未读数**，使用独立构建的[completion + sidebar小包](sidebar-package/package.json)，不要直接把本仓库根目录下的文件URL当Loader入口。不要同时启用sidecar与完整0.3.0客户端：它们有意提供同一个筛选ID。

## 运行要求

**原生角标：**Windows 10/11、Explorer 与可见 DSH 任务栏按钮，已有可信 Windows **Python 3.10+**。**侧栏：**工作区扩展API v1及独立完成投影，不依赖Python/Windows。**Node 22+**；DSH **`>=0.2.1-rc.2 <0.3.0`**，需官方 `subprocess`、`sessionProjections`、`connection`、`webServer` 及客户端 Chat/Session/Conversation/Slot 服务。插件包已附带官方客户端贡献；其他对话视图不自动确认。详见[兼容说明](docs/operations.zh-CN.md)。

## 从源码安装

使用**当前 Desktop 安装自带的官方 CLI**。这是用户手动安装步骤，仓库测试不会修改现用 profile。

```powershell
$DshCli = Read-Host '本次 DSH 安装中 resources\runtime\cli\bin\dsh.cmd 的完整路径'
$Project = (Resolve-Path .).Path
& $DshCli plugin --profile desktop add --ignore-scripts $Project
```

若建立本地链接，请保留源码目录。启用前先停用其他角标提供者。安装/更新客户端贡献后，若现有页面尚未加载新贡献，请刷新原 DSH 页面。[操作与回滚](docs/operations.zh-CN.md)。

## 设置与开发

**默认简体中文，缺失翻译也回退中文。** `language: en` 为英文，仅显式 `auto` 跟随环境。自动发现失败时配置精确 `desktopExecutable` 和可信 `pythonPath`。[配置说明](docs/configuration.zh-CN.md)。

```powershell
npm run build
npm test
npm run test:python
npm run test:pack
```

已安装插件不依赖 Pillow/字体。重新生成资产及 Python 资产测试需先在开发环境运行 `python -m pip install -r tools/requirements-assets.txt`，之后离线执行；Pillow 仅限开发，不给 helper 增加依赖。测试不调用收费模型、不改现用 profile、不操作真实任务栏。[测试证据与限制](docs/verification.zh-CN.md) · [图片](docs/images.zh-CN.md) · [同类比较](docs/alternatives.zh-CN.md) · [参与开发](CONTRIBUTING.md) · [安全说明](SECURITY.md) · [资产来源](ASSET-PROVENANCE.md)。

## 许可

[MIT © 2026 O-OII contributors](./LICENSE)。
