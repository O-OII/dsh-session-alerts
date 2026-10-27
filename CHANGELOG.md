# Changelog / 更新记录

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
