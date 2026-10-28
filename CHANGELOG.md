# Changelog / 更新记录

## Unreleased / 未发布

- Replace the completed-only workspace control with a live **unread bell**: match only main sessions whose native `ctx.uiSession.sessionStatus` entry has `completionUnread === true`. Intersect with native search/archive visibility and other filters; status changes update the view without marking anything read. Completion, running, goals, pending interactions and historical logs do not infer unread. Retain the completed projection and old helpers for compatibility, disconnected from the bell.
- Use explicit off/on Chinese hover labels **“未读过滤” / “重置条件”**, localized pressed/accessibility states and an unread-specific no-match message. Reset disables only this bell, preserving search and other conditions; an empty enabled filter remains live for later unread arrivals.
- Accept current `TimelineTurn` objects and legacy numeric `conversation.chat.turnTail` props while continuing to obtain the authoritative turn-end sequence from the Chat timeline.
- Add native-read synchronization only for the **current, ready, main-view-retained main session**, with visible/focused page and explicit native `completionUnread === false`. Require `blank === false` and a positive safe-integer main-view count; missing or malformed qualification never acknowledges a result. Fetch each pending terminal's exact Host revision/turn/end sequence and acknowledge by CAS without requiring an old footer to be scrolled into view. Do not sweep all false flags, acknowledge hidden/inactive/unknown sessions, or clear waiting interactions; invalidate stale evidence across view/lifecycle/connection changes.
- Preserve queued explicit retry/re-enable force in the retained legacy completion-filter helper, and publish pending while an unknown baseline is being retried; the helper is not wired to the unread bell.
- Clarify that badge totals still include pending interactions and can differ from native browser-memory sidebar unread, including while newer background work runs. Native unread follows the browser lifecycle and is not invented by replaying historical completion logs.
- Stock rc.3 still lacks workspace extension API v1. Keep the local compatibility SDK on its fixed SHA-256 baseline; do not present it as an upstream API/release. Durable upgrades require a repaired package archive, pinned manifest/lockfile resolution and staged atomic replacement, not an in-place pnpm-store hardlink or `node_modules` client-bundle edit. Machine-local backup archives are not public release artifacts.
- Add fake regressions for unread status changes, native workspace/search/archive composition, reset, both turn prop shapes, scoped native-read synchronization, revision/lifecycle races and waiting preservation. Personal-machine live checks are not public multi-environment release visual evidence; no new screenshot or test-total claim is made here. This entry does not declare a version release, npm publication, or live-profile deployment.
- 中文：铃铛改为仅筛原生 `completionUnread === true` 的未读主会话，实时与搜索/归档/其他条件取交集，不清未读、不从完成历史推断；中文 hover 关闭“未读过滤”、开启“重置条件”，空态明确无匹配，重置只关本铃铛且保留搜索。完成投影和旧 helpers 仅作兼容，不接入铃铛。
- 中文：修复 `turnTail` 对象/数字轮次兼容；增加当前 ready + retained 主会话的前台原生已读逐 revision CAS 同步，要求明确 `blank === false` 及正安全整数保留计数，缺失/异常不确认，不强制滚旧页脚、不遍历所有 false、不清 waiting；隐藏/未激活/未知状态不能凭空全局 ack。角标仍统计待处理交互，与 browser 生命周期的原生侧栏内存未读并不保证完全一致。固定基线本地 SDK 不冒称上游官方已有 API；持久升级须修复归档、固定 manifest/lock、原子替换，避免原地改写 pnpm store 硬链接。补充 fake 回归，个人本机 live 不充当公开多环境视觉验收；暂不声明版本发布、不 npm 发布、不操作现用 profile。

The 0.3.0 completed-only entries below describe historical source preparation; the current bell follows the Unreleased unread semantics above.

以下 0.3.0 的只看已完成记录保留历史源码准备事实；当前铃铛以上述 Unreleased 未读语义为准。

## 0.3.0 — 2026-10-27 (source prepared; deployment is a separate operator action)

- Rename the product to **DSH会话提醒 / DSH Session Alerts** and repository metadata to `dsh-session-alerts`; preserve the technical npm/settings/native contribution identity.
- Add the native workspace header completed-only toggle and loading/unknown/empty status contributions through workspace extension API v1. Compose with grouping/search/archive/order/other filters without DOM hiding, title inference or Session metadata writes. Stock rc.3 needs the separately user-authorized SHA-pinned compatibility engineering project, excluded from the main npm package.
- Add independent wired completion projection using official strict Goal replay and consumed-work accounting semantics: exclude empty no-ops, dropped unrun input, unsuccessful/running/waiting work, subagents and intermediate goal rounds; clearing a goal cannot launder its prior accounting end into success.
- Read cold authority through official projections, at most four concurrent requests; own generation/fingerprint cache, canceled stale requests, bounded unknown retries and no recurring all-log sweep. Confirmed running descendant subagents veto their associated main root; unresolved orphans do not contaminate unrelated mains. This certifies DSH terminal success, not business acceptance or unbounded external jobs.
- Build the standalone private `sidebar-package` from shared sources: completion-only Host + sidebar-only client, separate identity, bundle patch and bilingual metadata. It can be added beside an existing old badge engine without reloading that engine or duplicating its read marker.
- Preserve the verified native unread reducer/controller/RPC/native helper. No deployment, commit, push, restart or paid call is performed by source tests.
- 中文：产品改名并保留技术ID；通过明确的工作区API v1增加只看已完成及加载/未知/空态，正确组合原视图，不DOM隐藏/猜标题/写元数据。独立完成投影复用严格goal并遵循真实消费工作规则，冷读四并发、自有代际缓存、取消/未知回退，排除运行子代理并真实Client DTO优先使用parentId，未归属孤儿不污染无关主会话。独立sidecar只加载completion+sidebar，不重载旧未读引擎；兼容SDK工程隔离且不进主npm包。测试不部署、不提交/推送、不重启、不收费调用。

## 0.2.2 — 2026-10-27 (artwork-only source update)

- Replace 3×5 block numerals with independently authored rounded cubic-Bezier strokes, round caps/joins, dark single-number circles and multi-character capsules; transparent antialiased outskirts. No fonts or copied font outlines.
- Rasterize each 16/24/32/48/64 px DIB independently at 8× resolution with pinned development-only Pillow and LANCZOS reduction. Runtime helper remains standard-library-only and unchanged.
- Validate all 100 ICO containers, representative byte-for-byte regeneration, alpha edges, contrast and actual 32/64→16 reductions. Native taskbar acceptance is separate from generated previews.
- Unread, client/RPC, authentication and Host/helper lifecycle logic are unchanged; only the diagnostic version constant advances with package metadata.
- 中文：仅重设计资产为原创圆润贝塞尔数字及圆/胶囊深底、透明平滑外缘，100个ICO保留五种独立渲染尺寸。Pillow为固定版本开发依赖，不引入字体或运行依赖；增加原生小尺寸/实际缩小回归。未读、RPC、认证及生命周期逻辑不改，只同步诊断版本常量。

## 0.2.1 — 2026-10-27 (local source update, not published)

- Fix actual Cordis service-getter shadow ownership: adding consumer `webServer` injection alone was insufficient. Register through public `ctx.extend({ webServer: ctx.webServer })` and explicitly own the returned route disposer with `ctx.effect`. No private symbols, provider mutation or authentication bypass.
- Replace raw-register-only confidence with complete official Cordis 4.0.5 + complete Connection rc.3 class/getter regressions: reproduce the old failure despite injection, verify production registration and HTTP 401 gate, and verify restart/disable/re-enable route cleanup while the provider remains alive.
- 修复真实 Cordis getter 阴影作用域：仅增加消费方 inject 不足，改用公开扩展上下文携带已授权 webServer，并显式持有路由 disposer；不改 provider、不用私有符号、不绕过认证。完整官方框架与完整 Connection 类/getter 回归覆盖旧失败、401 认证门及生命周期清理。

## 0.2.0 — 2026-10-27 (local source update, not published)

- Replace window-level acknowledgement entirely with per-session unread terminal results. No old mode or compatibility path. Foreground A does not suppress completions in B.
- Bundle an official browser contribution through `dsh.client` and `./client`: real Chat result-footer intersection + active main binding + document visibility/focus + exact timeline turn/end sequence, followed by authenticated per-session revision CAS. Stale, duplicate, old-turn and previous-mount receipts cannot clear newer results.
- Keep unread terminal results independent of unresolved waiting requests; new turns, request resolution, Session object disposal, page refresh/disconnect and native-helper restart do not discard terminal unread. Host/plugin restart remains intentionally ephemeral, without history replay.
- Remove native foreground lookup/suppression and preview bypass; draw the same aggregate on exact-executable windows and retry failed drawing without requiring topology change.
- Explicitly inject `webServer`: the official Connection RPC registrar reads that service from its caller's scope. Add service-declaration guards and direct execution of the shipped SDK registration method to reproduce missing-inject failure and verify route teardown.
- Add isolated Host/client/loader tests for 5→4, foreground A/background B, multi-window duplicate receipts, visibility changes, reconnect and both ACK/event race orderings. Update bilingual behavior/security/operations and package assertions.
- Waiting-only view acknowledgement and non-Chat result acknowledgement remain unsupported; actual answers/decisions retire waiting. No live configuration/install, commit, push, restart or paid model call performed by these tests.

### 中文

彻底替换窗口清零为逐会话结果未读，没有旧模式/兼容开关；前台 A 不抑制 B 完成。随包提供官方客户端贡献，以当前主会话、可见/焦点、真实 Chat 结果页脚交集和精确轮末序号取证，经官方认证 RPC 对会话版本 CAS。旧轮次/版本、重复和上次挂载确认不能误清新结果。终态未读与临时等待分别保留，对象卸载/新轮次/请求解决/页面断线刷新/helper 重启不丢结果；Host/插件重启不持久化，不重放历史。移除原生焦点抑制与 preview 绕过，所有精确 exe 窗口显示同一聚合数。补充5→4、双窗口、前台另一会话完成、可见性/重连和两种竞态顺序测试及双语文档。待处理问题仅查看和非 Chat 自动确认尚不支持，实际回答/决定结束等待；测试不部署、不提交/推送、不重启、不调用收费模型。

## 0.1.1 — 2026-10-26 (local source update, not published)

- Default diagnostics, native accessibility/error descriptions, generic schema metadata, package description and asset preview to Simplified Chinese; missing/empty/unsupported locales and missing translation keys also fall back to Simplified Chinese.
- Preserve explicit English and opt-in `auto`. Auto still respects LC_ALL → LC_MESSAGES → LANG (or the browser language in the standalone preview), so an English environment intentionally selects English only when auto was explicitly requested. Existing explicit preferences are not rewritten.
- Align the standalone Python helper's default/fallback and CLI locale normalization with JavaScript. Keep original OS/provider/standard-library error details.
- Add Chinese-default/explicit-English/auto/fallback regressions and real offline npm-pack assertions for 0.1.1, unpacked runtime defaults, bilingual catalogs, all 100 icons and private/test artifact exclusion. This dependency-free repository had no lockfile; none was added.
- No badge counting, focus/clearing, executable path discovery, notification preferences or charging behaviour changes. No profile/install/publish actions.

### 中文

默认语言及缺失/空值/不支持语言和缺失翻译键回退改为简体中文，覆盖 JS、Python 诊断与可访问性描述、通用 schema 元数据、包说明和资产预览页。保留显式 `en` 与 `auto`，默认无需配置且不读取环境；显式 auto 在英文环境仍显示英文。补充默认中文/英文/auto/回退回归及真实离线打包、解包校验，版本更新为 0.1.1。原仓库无依赖且无 lockfile，本次不新增。角标功能、路径发现、通知偏好和收费行为均未改变；不改现用 profile，不安装、不提交或发布。

## 0.1.0 — 2026-10-24 (source preparation, not a published release)

- Standalone `dsh-native-taskbar-badge` bundle and path-free install patch; no live-profile changes or registry/npm publication.
- Windows COM `ITaskbarList3` number overlay with per-main-session deduplication, window-level acknowledgement, approvals/questions, optional error/goal-round filtering, subagent exclusion, bounded helper retry/disposal and Explorer/window-topology recovery.
- Bounded executable/Python discovery with actionable fail-closed configuration errors. No personal hardcoded paths, `PATH` search or user-directory scanning; Electron is never selected as Python.
- Removed the previous helper's process AppUserModelID setter and title-substring filter. Full executable path remains mandatory; multiple visible matches are refused. Fresh real Windows acceptance remains required after these changes.
- Complete English/Chinese settings metadata and diagnostic/native descriptions, package-owned locale namespace and English fallback.
- Replaced font-derived legacy icons with 100 independently generated font-free geometric ICOs and a deterministic standard-library generator; reviewed SVG retained.
- Retained five baseline fake suites (63 JavaScript + 29 Python cases), added portability/path/catalog/configuration coverage and cross-platform fake-only CI.
- Added bilingual documentation, license, contribution/security guidance and explicit screenshot/verification boundaries. No historical private status, backups, private integration modifications or screenshots exported.

### 中文

完成独立包、路径发现安全失败、中英文元数据及诊断、无字体原创数字资产、离线 fake 回归与文档。移除 helper AppUserModelID 调用及模糊标题匹配，仍按完整 exe 校验且多窗口拒绝猜测。保留原 63 JS + 29 Python 基础用例并扩展。此版本只准备源码，未发布、未修改现用 profile；新副本仍需真实 Windows 验收，不沿用历史私密验证产物。
