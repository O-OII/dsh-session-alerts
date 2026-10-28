# 已完成主会话：语义与组成分

[README](../README.zh-CN.md) · [English](completed-filter.md)

## 使用原生工作区，不替换列表

圆圈勾选按钮通过root/list `sidebar.workspaces.header.action`进入原生工作区标题栏，具有稳定可访问名称、`aria-pressed`、原生键盘按钮行为和提示。`sidebar.workspaces.filter.status`显示加载、未知与空态；恢复按钮只关闭本筛选。页面刷新后默认关闭。

贡献ID为`dsh-native-taskbar-badge.completed`，要求`ctx.uiWorkspace.sessionFilters.apiVersion === 1`。Source发布不可变`{enabled, matchingSessionIds, pendingSessionIds, unknownSessionIds}`快照；SDK对多个启用的贡献取AND，在原生分组/树/平铺/搜索候选中、当地结果截断前应用。不重写完整成员、手动排序、置顶/归档集合、搜索文本。当前对话即使行不匹配，也可以继续打开。保留原Host内容搜索上限及排序语义。

stock rc.3缺少这些入口，经用户另行批准的隔离[兼容工程](../compat/workspace-sdk/README.md)只接受精确SHA固定的官方工作区包，保留ModuleID和依赖图，不改ASAR。它是本地SDK扩展，**不是上游正式发布，也不打入主npm包**。缺API时报告不可用（能挂状态槽则显示状态），不放假筛选开关。

## 成功的定义

独立Host投影`sessionAlertsCompletion`折叠已提交事件，工作记账遵循官方`dsh-agent.foldConsumedWork`：

- 真正进入step的工作才记账；消费输入后、step之前异常结束也记为那笔工作的失败。
- step前`completed` claim或空no-op不能凭空判成功，不能洗掉之前真实工作失败。
- 取消并丢弃未执行输入会否定旧成功，直到后来真正工作记账结束。
- 最新记账结局必须为`completed`；错误、阻塞、输出超限、取消、中断、fork历史标记不算。
- 当前轮次未关闭或有审批则排除；客户端运行/待输入权威状态进一步即时否决。
- Goal完全复用**官方严格goal projection definition**，包括持久failure标志。损坏goal可能使普通wire仍停在旧complete，新完成投影会变unknown，不信旧值。
- 记账结束时保存goal phase/id。活动/暂停/阻塞目标中间回合在clear后仍不算完成。采用保守规则：goal必须在该记账结束时已经complete；之后单独complete边不追认旧中间回合。
- 工作记账只折叠本会话owned suffix（`event.seq >= inheritedEventCount`）；goal校验覆盖全部继承历史，cut写入checkpoint。普通主会话fork可显示，不能仅凭非空`parentSessionId`排除。

这仅表示**DSH终态成功结束**，不是自动验收现实业务或所有外部进程。已恢复的中间tool/assistant-attempt错误不永久否决，最终记账结局为准。

## 冷读、缓存与竞态

客户端直接调用官方`remote.session.projections({sessionId}, signal)`，最多**四并发**；不retain/open，不使用会对“ready但缺新key”短路的`refreshProjections`，不激活Agent、不写会话/目录元数据、不确认未读。

自有缓存绑定连接代际和权威目录/投影指纹，不按1.5秒周期反复解压所有冷日志。真实目录/运行/投影变化使相关证据失效，单纯保留/视图变化不重读。未知状态30秒后或用户显式重判再试；重新打开筛选是显式刷新。关闭/卸载取消排队及在途操作，释放订阅/计时器，丢弃过时代际/版本响应。缺失、损坏或需迁移数据保守列unknown并排除。

用`origin: subagent`、真实ClientSessions DTO的`parentId`父链及Session/runtime running事实映射运行子代理（`parentSessionId`/header仅回退输入）。已确认的运行后代会排除其关联主根；父链缺失或循环仅记为未解决诊断，不据此污染无关主会话，更不会一条孤儿把所有主会话变unknown。此策略只排确认运行后代，不声称完整族谱证明。扫描限于已加载目录，不无限递归外部job；本契约外的后台作业/外部系统不独立认证。

完成不等于未读：看过成功结果仍能出现在完成筛选里。原角标未读引擎不变。

## 安全组成分

- **正常新装/完整升级：**root bundle包含原生引擎/客户端、独立`./completion` Host entry及侧栏。原生路径检查不门控completion。root重载仍遵循已说明的内存未读生命周期。
- **给运行中的旧引擎只加侧栏：**构建出的`sidebar-package`是独立私有本地包`dsh-session-alerts-sidebar`，Host只做completion（inject仅`sessionProjections`），client只做sidebar；共享源码复制构建，具备独立包/ModuleID、locale和bundle patch，不启动Python、不贡献旧read marker。旧引擎依然是其真实旧版本，不冒称已原地升版。
- 不要在已有另一个安装根的相同npm包旁直接挂root源码completion文件URL，否则ClientModules可能看到重复包根/客户端贡献；使用独立sidecar。
- 不同时启用完整0.3.0客户端与sidecar，它们有意提供相同filter ID。
- 测试不安装、不改现用profile、不重启、不推送、不调用收费模型。本机SDK组成/部署是操作者另行动作；若需重启，先停止并征得许可。
