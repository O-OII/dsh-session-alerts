# 历史完成分类辅助实现——不是未读铃铛

[README](../README.zh-CN.md) · [English](completed-filter.md) · [当前未读过滤](unread-filter.zh-CN.md)

0.3.0 基线曾提供已完成主会话视图。当前铃铛改为原生 `completionUnread` 过滤，**不调用这些完成分类辅助实现**。保留此文件名用于既有链接与兼容说明，不代表另一个已启用的工具栏模式。

## 保留的成功投影

独立 Host 入口 `./completion` 注册 `sessionAlertsCompletion`，只读折叠已提交事件，工作记账遵循官方 `dsh-agent.foldConsumedWork` 语义：

- 真正进入 step 才记账；消费输入后、step 之前异常结束也记录失败。
- step 前的 `completed` claim 或空 no-op 不凭空判成功，也不能洗掉此前记账失败。
- 丢弃的未执行取消输入会否定旧成功，直到后续真正记账的工作结束。
- 最新记账结局必须为 `completed`；错误、阻塞、输出超限、取消、中断和 fork 历史标记不算成功。
- 未结束的轮次及审批不是成功证据。
- Goal 复用官方严格投影及持久失败标记；未知/损坏状态不相信旧的普通 goal wire 值。
- 保存记账结束时的目标阶段/id。活动、暂停、阻塞轮次不因后来 clear 变成功；目标必须在记账结束时已经 complete。
- 工作记账仅覆盖 owned suffix（`event.seq >= inheritedEventCount`），目标校验则覆盖继承历史。普通 fork 不因有父 ID 就成为子代理。

这只分类 DSH 消费工作，不独立验收业务目标。中途已恢复的 tool 错误不永久否决后来成功；这些值不能证明人是否读过结果。

## 保留的 reader/filter 工具

`completion-reader.mjs` 可最多四并发调用官方 `remote.session.projections({ sessionId }, signal)`，不打开/保留会话、不写元数据。旧 `completed-filter.mjs` 为兼容及回归保留代际缓存、unknown 重试/取消和规范父链的后代运行处理。批次进行中排队的显式重试/重开会保留 force，unknown 重读在进行中发布 pending。

这些工具**不包含在当前生成的未读侧栏 factory 中**。未读过滤不做冷投影读取，也不因工作失败、目标活动或后代运行而额外排除真实未读标记。不要把旧 completed filter ID 作为隐含 AND 条件挂到当前铃铛旁边。

## 组件与兼容

- 完整 root bundle 在原生角标和未读侧栏旁保留独立完成 Host 入口。
- 私有 `sidebar-package` 是独立的 completion-only Host 加 unread-only 客户端；完成投影不启动 Python，也不受原生配置检查门控。
- root 完整客户端与 sidecar 只启用一种；两者当前都拥有 `dsh-native-taskbar-badge.unread`。
- stock rc.3 仍需操作者另行批准的[固定基线工作区 SDK 扩展](../compat/workspace-sdk/README.md)。兼容工程不是上游 SDK 发布，也不进入主包归档。
- 不要用同一 npm 包的多个安装根或文件 URL 重复加载 Host 入口，否则可能产生重复客户端贡献。

单测与 oracle 使用 fake/只读夹具，不安装插件、不改现用 profile、不重启 DSH、不调用付费模型。部署是操作者另行明确的动作。
