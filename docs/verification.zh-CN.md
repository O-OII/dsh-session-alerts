# 开发与验证

[README](../README.zh-CN.md) · [English](verification.md)

## 离线复现

```powershell
npm run build
npm test
npm run test:python
npm run test:pack
```

运行时无第三方 Python/字体依赖。资产再生和 Python 资产测试需先以 `python -m pip install -r tools/requirements-assets.txt` 准备固定版本的开发用 Pillow，之后离线运行。构建把客户端源码和确认驱动确定性包装为官方惰性 loader factory，`npm test` 先校验随包 bundle 与源码一致。实际打包使用已有 npm 的 `pack --ignore-scripts --offline`，压缩包、缓存与解包核验均限制在 ignored `artifacts/`。项目没有 npm 运行依赖；独立 artwork requirements 文件固定开发绘制器版本。

## 当前未读过滤与已读同步修复

root fake 套件覆盖原生未读过滤、双语铃铛精确状态、已读/新未读变化、当前视图确认资格、非空/保留证明异常、取消往返、版本替换、等待保留和生命周期清理。固定基线工作区套件以真实 React 验证未读源在分组/树/平铺/搜索的集成；CI 运行其全部测试文件，不再只运行原 SDK 文件。

除上方命令外，独立兼容工程运行：

```powershell
node compat/workspace-sdk/scripts/build.mjs
node --test compat/workspace-sdk/test/*.test.mjs
```

按该工程 README 单独准备锁定的测试用 React 依赖。这些是 fake/隔离测试，不代表部署现用 profile 或新的公开原生截图验收。打包断言要求未读模块及双语说明，并排除诊断/安装工件。持久更新和重装核对应遵循[归档/锁定/硬链接注意事项](operations.zh-CN.md#持久更新归档锁定与硬链接)，不原地改写正在使用的包。

## 历史 0.3.0 基线

原始0.3.0可移植JavaScript套件通过 **180项测试**，覆盖标题栏/状态贡献契约、双语可访问开关、缺API保守不可用、集合组合、只读四并发冷读、已知基线缓存、代际取消、运行后代/未知父链、消费工作记账、严格goal失败/clear、fork cut及独立sidecar输出；保留之前所有未读/read-CAS/native/资产回归。测试不写会话元数据、不激活Agent或原生helper。

独立oracle测试执行**真实官方导出**`dsh-agent.foldConsumedWork`和完整`dsh-goal.goalProjectionDefinition`，不是猜latest-turn。对80轮有效混合历史的每个prefix比较结果，验证真实严格goal损坏/clear与fork owned suffix，并仅用`sessionProjections`调用两个真实completion-only Host入口：

```powershell
$env:DSH_BADGE_SDK_ROOT = Read-Host '只读提取的官方 node_modules 依赖闭包'
node --test tools/completion-sdk.test.mjs
```

独立`compat/workspace-sdk`测试构建精确哈希固定的原生工作区基线，使用真实React渲染验证分组/树/平铺/搜索/其他筛选组合。CI单独准备其锁定React开发依赖，主包排除整个工程目录。这不代表新侧栏已在每版DSH/每种OS实机验收；GUI/profile加载是操作者另行动作，原角标截图只证明此前受控原生probe。

### 历史 Remote 命名空间与 GUI 检查

两个客户端入口均显式inject `remote.session`（除`remote`外）；这是Cordis真实命名空间依赖，只有包依赖图声明不够。`tools/client-namespace-sdk.test.mjs`在真实Cordis中挂载完整官方ClientRemoteService和生成ApiRemotes assembly，复现缺依赖错误，再通过两个真实客户端声明调用生产reader，验证自定义完成wire保留。仅下层传输/类型注册存储为fake，框架/命名空间不是普通remote对象mock。使用同一`DSH_BADGE_SDK_ROOT`环境运行。

针对历史完成筛选基线（不是当前未读铃铛），操作者另行真实GUI核实：28×28按钮可命中、pressed切换；原7个可见主会话/15树项开启后为6个完成会话/11项（含已确认权威完成项及原limit之后的更旧完成项），关闭后精确恢复原rows/items，query不变，slot errors为空。这是操作者本机部署验收，不是源码测试执行了部署，也不代表每OS/版本都实测；独立sidecar保留旧native引擎真实版本身份及未读内存。

## 0.2.2 资产验证

Windows 本机通过 **129 项 JavaScript + 43 项 Python + 3 项离线打包测试**，无失败/跳过。五项资产测试覆盖全部100个五帧ICO结构、原创路径确定性再生、透明角落/抗锯齿、白字深底对比、实际32/64→16缩小，以及运行helper无Pillow/字体导入。再次重生全部100ICO后SHA-256完全一致。原生helper、未读、客户端/RPC及生命周期实现不改，只推进包/诊断版本元数据。

另行实机probe 1/5/4/12/99+均COM成功并经视觉检查。首页现为132×48像素任务栏区域，不承诺周围固定有几个图标；它们只证明绘制，不代表模型任务、所有DPI或已读全链路验收。CI已加仅开发Pillow准备步骤；本机测试未执行远程CI、部署或收费调用。

## 0.2.1 本机证据

Windows、Node **22.22.3**、Python **3.10.8** 的本轮隔离实跑通过 **129 项 JavaScript + 40 项 Python + 3 项真实离线打包测试**，无失败/跳过。使用 fake Host、浏览器/React/Slot/IntersectionObserver、helper 管道和 Win32/COM，**不操作现用 profile、已安装插件、真实任务栏，不重启服务、不调用收费模型**。独立离线打包套件验证真实压缩包与解包运行时，发布文件修改后应重跑。

覆盖：

- 五个未读会话，只有一个最新活动/可见结果暴露后变为四；前台 A 不确认 B。
- 使用真实 `turn/end.seq`，不是更早的 assistant 消息序号；查看旧轮次不能清除新结果。
- 两种 ACK/事件先后顺序、挂载 epoch、重复/双窗口确认、会话去重。
- 在途隐藏/失焦/切会话/断线/停止的取消，重连与页面重建，失败重试不乐观减数，以及 observer/listener/timer 释放。
- 终态未读与临时等待独立，等待解决/新轮次/对象卸载不丢结果，子代理 origin/depth 过滤及取消/历史/目标策略。
- 原生不抑制前台、多匹配窗口同一聚合值、完整 exe 过滤、资源释放、有界 helper 重试、拓扑/绘制失败恢复。
- 中文默认、英文/显式 auto 回退、安全路径失败、100 个原创 ICO 及包隐私排除。

只读检查了官方已发包的 client modules、Connection、Session、UI Session、Conversation 和 Chat 契约，没有修改 SDK 或应用安装源。在当时0.2.1基线中，没有单独采用内置 `completionUnread` 作为已读证明，因为它基于主视图保留，没有可见性/版本校验。当前受限主视图路径补充了这些资格与CAS防线，仍不信任整批false标记。

## 官方 SDK 路由注册回归

完整官方 Cordis 代理会在 provider-shadow Context 中求值 Connection 的 `rpc` getter，仅增加消费方 `webServer` inject 并不足。生产代码现使用公开 `ctx.extend({ webServer: ctx.webServer })` 携带已授权服务，并显式持有路由 disposer。契约套件从只读提取的依赖闭包导入**完整 Cordis 4.0.5 与完整 Connection rc.3 类**，执行真实构造器、Service 代理和 getter；不安装/修改 SDK、不改 provider、不用私有符号、不启动服务器。之前仅运行原始 register 的检查未覆盖此归属问题，不能作为部署证据。

```powershell
$env:DSH_BADGE_SDK_ROOT = Read-Host '只读提取的官方 node_modules 依赖闭包绝对路径'
node --test tools/host-sdk-contract.test.mjs
npm test
```

三项完整框架回归均通过：消费方已有 inject 时，旧直接 getter 调用仍复现错误；生产注册正常且真实 route handler 对未认证请求仍返回 HTTP 401；Connection provider 存活时，restart/disable/re-enable 均释放路由归属。普通 129 项 JavaScript 测试也通过声明守卫检查。这验证了真实框架归属与注册，WebServer 仅为 fake 路由表，不等于 live HTTP/原生部署验收。

## 证据边界

fake 浏览器不等于真实布局/遮挡验收，模拟 COM 不证明真实任务栏、DPI、分组或 Explorer 行为。[CI](../.github/workflows/test.yml) 在 Windows/Ubuntu 跑 fake 逻辑；Windows runner 成功不代表原生截图。Host 重启持久未读、待处理问题仅查看解决尚不实现。页脚暴露路径仅限 Chat；当前视图同步依赖受支持的公开原生已读来源，不宣称覆盖所有 renderer，详见[行为说明](behavior.zh-CN.md)和[图片来源](images.zh-CN.md)。

若另行提供原生截图，必须区分真实 shell 像素和受控计数输入。探测数字截图证明绘制，**不代表真实运行了五个会话，也不证明切换是由真实客户端已读触发**。示意图不能标记为原生实拍。
