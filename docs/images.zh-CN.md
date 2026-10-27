# 文档图片

[README](../README.zh-CN.md) · [English](images.md)

## 原生探测截图

README 中的[角标 5](images/native-badge-5.png) 和[角标 4](images/native-badge-4.png) 为另行捕获的真实 Windows 任务栏区域，每张 210 × 48 像素，DSH 位于前台；保留原始捕获像素，不是合成任务栏。同一 DSH 窗口由 helper 输入受控值 5 和 4，两次 COM 均返回 `HRESULT 0`。它们证明这些探测值的真实绘制，不代表五个真实模型任务、已读确认全链路或 DPI/Explorer 兼容矩阵；5 → 4 状态逻辑另有隔离集成测试证据。

## 预览源

0.2.0 已移除错误的旧“窗口清零”流程 PNG，HTML 流程源已改为 5 → 4，重新生成并审图后再嵌入。隔离重设计测试没有拍摄原生截图。

| 预览 | 源码查询参数 | 用途 |
| --- | --- | --- |
| 附带资产 | `?view=assets&lang=zh` | 直接读取 `1.ico`、`2.ico`、`12.ico`、`99plus.ico`，观察浅深底轮廓，并列出五种内嵌尺寸。 |
| 数字状态 | `?view=states&lang=zh` | 说明一个、十二个、超过九十九个不同主会话；显示的仍是原始 ICO。 |
| 逐会话已读流程 | `?view=flow&lang=zh` | 五个会话完成 → 仅切回 A 不清零 → 查看 A 最新结果 → 仍有四个未读。 |

这些是**浏览器渲染的资产预览与行为示意，不是 Windows 桌面截图或原生验收证据**。说明卡不仿制任务栏；不使用真实 profile、会话、窗口匹配、COM 调用或 Explorer 交互，事件名称均为说明用例。

## 复现

1. 使用源码目录；预览工具不进入最小运行时压缩包。
2. 本地安装开源 [Noto Sans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC)（SIL Open Font License）。HTML 仅用 `local()` 读取字体，不下载字体；`window.previewReady` 返回 `fontLoaded`。仓库不分发字体文件。
3. 用 Chromium 打开 [HTML 工具](../tools/readme-preview.html)，附加上表查询参数；英文用 `lang=en`。默认中文，显式 `lang=auto` 才跟随浏览器语言。
4. 设置 **1200 × 570 CSS 像素视口**、设备缩放系数 **1**、浏览器缩放 **100%**。等待 `window.previewReady` 完成，确认 `fontLoaded: true`、图片全部解码、文字无裁切且视口无溢出（流程箭头有意延伸至卡片间隙），再截取不含浏览器外框的 PNG。
5. 资产页保存为 `docs/images/badge-assets-zh.png`，状态页为 `badge-states-zh.png`，流程页为 `badge-flow-zh.png`；英文对应 `-en.png`。发布前逐张审图，不添加合成桌面/任务栏背景，不暗示测量了原生显示位置。

项目 SVG 和数字 ICO 均直接加载，未重绘、改色或换成字体数字。Noto 只用于说明文字，ICO 数字仍是无字体几何图案；不同平台/浏览器的文字栅格化可能略有差异。

## 验证边界

审图仅验证可读性、语言、原生资产加载及与文档规则的一致性，不能证明 shell 位置、DPI、分组或真实覆盖角标清理。另行授权的原生验收见[贡献指南](../CONTRIBUTING.md#real-windows-acceptance-manual-separate-consent)。
