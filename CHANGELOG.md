# Changelog / 更新记录

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
