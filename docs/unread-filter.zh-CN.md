# 未读会话：原生状态与筛选组合

[README](../README.zh-CN.md) · [English](unread-filter.md)

## 铃铛的作用

16px 细线铃铛通过 `sidebar.workspaces.header.action` 进入原生工作区工具栏。按钮具有 `aria-pressed`、原生键盘操作，以及一致的可访问名称和 hover 提示：

| 状态 | 简体中文 | English |
| --- | --- | --- |
| 未开启 | 未读过滤 | Unread filter |
| 已开启 | 重置条件 | Reset filter |

点击后只保留未读主会话，再次点击**仅取消这项未读条件**。保留搜索文本、归档/置顶集合、分组、排序、工作区成员与其它筛选。过滤本身不打开/保留会话、不发送已读回执、不标记全部已读、不删除或归档会话。已打开的对话可以继续显示，即使其已读行被过滤掉。

开关仅保存在当前页面内存，默认关闭。没有匹配时仍保持开启，后来出现新的原生未读通知会立即进入结果。状态槽说明当前没有符合条件的未读会话，并提供相同的重置操作；不再显示完成投影的加载、未知或重试状态。

## 只读取原生未读位，不判断任务成功

`unread-filter.mjs` 订阅公开的 `sessions.list` 和 `uiSession.sessionStatus`。目录中的主会话只在以下条件成立时匹配：

```js
statusMap.get(sessionId)?.completionUnread === true
```

这就是原生工作区内部映射为展示字段 `completed` 的未读位。这个内部名字**不是**保留下来的 `sessionAlertsCompletion` 成功投影。

- 已读的成功结果不匹配；缺失、false 或非布尔标记均不匹配。
- 错误或其它停止后的结果，只要原生未读位为 true 也能匹配，不要求成功投影。
- 仅有 `pendingInteraction` 不等于未读；运行状态、目标阶段、运行后代或有颜色的状态点都不能替代原生标记，也不额外否决 true 标记。
- 主会话候选排除子代理/委派后代；普通 fork 不能仅凭父 ID 排除。
- 不进行冷投影/日志读取、不发分类 RPC、不设轮询定时器，也不推断历史读水位。

原生标记属于 DSH UI 服务的本地生命周期：观察到后台从运行转为停止时可设置，重新运行或主视图保留时可清除；初始空闲历史基线不会自动成为未读。新页面不能从完成历史重建持久未读。本筛选沿用这些原生规则，不自行发明跨刷新持久化。

## 原生工作区扩展与组合

贡献以 `dsh-native-taskbar-badge.unread` 注册到 `ctx.uiWorkspace.sessionFilters.apiVersion === 1`，发布不可变的 `{ enabled, matchingSessionIds, pendingSessionIds, unknownSessionIds }`。同步读取原生标记，后两个集合为空。注册表对启用的来源取 AND，在原生分组/树/平铺/搜索结果截断前应用，不通过 DOM 隐藏行，也不替换列表。

**stock rc.3 没有这些扩展槽位和服务。** 经操作者另行批准的[兼容工程](../compat/workspace-sdk/README.md)只针对精确 SHA 固定的官方工作区基线增加接口，保留模块身份和依赖图，不修改 ASAR。它不是上游 SDK 正式发布，且不包含在主包归档中。缺少工作区 API 时报告不可用，不挂假开关。

完整 root 客户端和独立 `sidebar-package` 只启用一种，它们拥有相同筛选 ID。sidecar 不启动 Python、不挂原生已读标记；其仅提供完成投影的 Host 组件为兼容而保留，但铃铛不再消费完成分类。[历史完成投影说明](completed-filter.zh-CN.md)描述保留的辅助实现。

## 为什么任务栏数字可能不同

任务栏统计 Host 跟踪的未读终态结果，以及按配置计入的未解决交互，每个主会话一次；这不是侧栏的浏览器本地未读集合。[已读策略](behavior.zh-CN.md)安全同步符合条件的当前原生已读主视图，或精确暴露的 Chat 结果，不会遍历所有 false 标记批量清除。后台重跑、隐藏窗口、提醒偏好和待处理交互仍可能导致两者不同。重置铃铛从来不是清空任务栏计数。
