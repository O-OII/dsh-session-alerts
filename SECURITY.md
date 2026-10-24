# Security / 安全说明

## Scope and trust boundary

The host plugin reads only live lifecycle/input-request events and a small official turn/goal projection. It never sends network requests, exposes model tools, modifies prompts/session logs, installs dependencies, edits ASAR files, or changes shortcuts, AppUserModelID, protocols, registry/startup entries. It runs at the current user's privilege, without elevation.

The selected Python executable runs code with that user's permissions. Configure only trusted local executables. Discovery is bounded to known DSH environment/install locations, not `PATH` or recursive private-directory scans. Absolute path and filename checks are safeguards, not binary attestation; a malicious executable renamed `python.exe` is still malicious. Windows policy and the official subprocess provider remain additional boundaries.

The helper uses isolated Python (`-I`), dedicated JSON-line stdin/stdout, a bounded response buffer in the host and three bounded crash retries. Only windows whose full process path matches the selected desktop executable are candidates. Multiple visible matches are refused; executable-path matching is not a security boundary against a hostile process able to modify that binary or run with the same path. No remote command interface is provided.

## Diagnostics and disclosure

The optional runtime status contains counts, phases, process IDs, window handles and error text. It does not intentionally include session IDs, titles, question/answer bodies or credentials. Operating-system/provider errors can contain local paths: inspect and redact before sharing. A hard crash or forced termination may bypass normal overlay cleanup. Disable the plugin if its helper behaves unexpectedly; do not force-kill unrelated processes.

For a vulnerability, use the repository's private [security advisory channel](https://github.com/O-OII/dsh-native-taskbar-badge/security/advisories/new) **if enabled after repository creation**. If unavailable, ask a maintainer for a private reporting route in a minimal public issue **without exploit details, credentials, personal paths or private attachments**. This source-preparation task does not itself create a GitHub repository or enable reporting. No response-time SLA is promised. Only the current 0.1.x source line is in initial review scope; report the exact version and fake reproduction when possible.

Third-party provenance/license problems are also release blockers: notify maintainers before redistribution. See [asset provenance](./ASSET-PROVENANCE.md).

## 中文摘要

插件不联网、不修改 ASAR/提示词/会话日志、不注册工具、不安装依赖、不改应用身份或系统项，使用当前用户权限。Python 路径必须可信，文件名与绝对路径校验不是二进制身份认证。只按完整 exe 路径匹配窗口，多个匹配拒绝猜测。

诊断不主动存储会话正文，但系统错误可能带本机路径，分享前审查脱敏。硬崩溃可能绕过正常清理，异常时停用插件，不终止无关应用。仓库建立并启用后优先私密安全报告；若渠道未启用，公开 issue 只询问私密联系方式，不附敏感细节。授权来源/许可问题也应在分发前立即报告。
