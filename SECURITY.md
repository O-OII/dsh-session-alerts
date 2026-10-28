# Security / 安全说明

## Scope and trust boundary

The native badge adapter reads live lifecycle/input-request events and the existing turn/goal projection. The independent completion entry folds committed logs through read-only projection infrastructure and the official strict goal codec. The browser uses authenticated same-Host read-receipt RPC and official cold projection reads, with bounded concurrency/cache; it does not retain/open Sessions, activate Agents, infer completion from titles, write Session metadata or acknowledge unread while filtering. It makes no external network/model calls and exposes no model tools. It does not modify prompts/session logs, install runtime dependencies, edit ASAR files or change shortcuts, AppUserModelID, protocols, registry/startup entries. It runs at the current user's privilege, without elevation.

The selected Python executable runs code with that user's permissions. Configure only trusted local executables. Discovery is bounded to known DSH environment/install locations, not `PATH` or recursive private-directory scans. Absolute path and filename checks are safeguards, not binary attestation; a malicious executable renamed `python.exe` is still malicious. Windows policy and the official subprocess provider remain additional boundaries.

The helper uses isolated Python (`-I`), dedicated JSON-line stdin/stdout, a bounded response buffer in the host and three bounded crash retries. Only windows whose full process path matches the selected desktop executable are candidates. All matching windows receive the same Host aggregate; executable-path matching is not a security boundary against a hostile process able to modify that binary or run with the same path. The scoped `/native-taskbar-badge` channel exposes only one-session pending/read operations. It preserves Connection authentication/trust and requires an owner Peer; there is no filesystem/process command endpoint. A read receipt carries the exact mount epoch, revision, session, turn and end sequence. It is a concurrency/accidental-read fence, not attestation against a malicious owner client.

## Diagnostics and disclosure

The optional runtime status contains counts, phases, process IDs, window handles and error text. It does not intentionally include session IDs, titles, question/answer bodies or credentials. Operating-system/provider errors can contain local paths: inspect and redact before sharing. A hard crash or forced termination may bypass normal overlay cleanup. Disable the plugin if its helper behaves unexpectedly; do not force-kill unrelated processes.

For a vulnerability, use the repository's private [security advisory channel](https://github.com/O-OII/dsh-session-alerts/security/advisories/new) **if enabled after repository creation**. If unavailable, ask a maintainer for a private reporting route in a minimal public issue **without exploit details, credentials, personal paths or private attachments**. This source-preparation task does not itself create a GitHub repository or enable reporting. No response-time SLA is promised. Only the current 0.3.x source line is in initial review scope; report the exact version and fake reproduction when possible.

Third-party provenance/license problems are also release blockers: notify maintainers before redistribution. See [asset provenance](./ASSET-PROVENANCE.md).

## 中文摘要

原生角标通过官方认证的同一Host RPC发送精确已读确认；独立完成投影只读折叠日志并复用严格goal校验，侧栏仅以有界并发/缓存调用官方投影冷读，不retain/open、不激活Agent、不猜标题、不写会话元数据，筛选不确认未读。不调用外部网络/模型，不修改 ASAR/提示词/会话日志、不注册工具、不安装依赖、不改应用身份或系统项，使用当前用户权限。Python 路径必须可信，文件名与绝对路径校验不是二进制身份认证。只按完整 exe 路径匹配窗口，匹配窗口显示同一聚合数。RPC 限 owner，只提供逐会话 pending/read，精确 epoch/版本/轮次/末序号校验是竞态保护，不是对恶意 owner 客户端的可信证明。

诊断不主动存储会话正文，但系统错误可能带本机路径，分享前审查脱敏。硬崩溃可能绕过正常清理，异常时停用插件，不终止无关应用。仓库建立并启用后优先私密安全报告；若渠道未启用，公开 issue 只询问私密联系方式，不附敏感细节。授权来源/许可问题也应在分发前立即报告。
