# Changelog / 更新记录

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
