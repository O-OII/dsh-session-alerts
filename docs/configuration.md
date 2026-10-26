# Windows paths and settings

[README](../README.md) · [简体中文](configuration.zh-CN.md)

This version has no separate visual settings page. Merge configuration into the current profile's `cordis.patch.yml`, preserving your existing notification preferences; do not insert a second plugin instance.

```yaml
- id: native-taskbar-badge
  config:
    enabled: true
    desktopExecutable: 'C:/Applications/DSH/DeepSeek Harness.exe'
    pythonPath: 'C:/Runtimes/Python/python.exe'
    notifyOnError: true
    notifyOnWaiting: true
    notifyOnGoalRounds: false
    language: zh
```

These paths show the format only; replace them with files that exist on your machine.

## Configure portable Windows paths

The standalone [bundle patch](../cordis.patch.yml) has no machine-specific absolute paths. Empty defaults mean bounded discovery, not "pick any similarly named window".

| Setting | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Start helper; disabling disposes it and clears its last overlay. |
| `desktopExecutable` | empty | Existing absolute Windows path to the **exact desktop executable**, not `dsh.cmd`, node or Python. |
| `pythonPath` | empty | Existing absolute Windows path to Python 3.10+ `python.exe` (versioned Python filenames accepted; not `pythonw.exe`). |
| `notifyOnError` | `true` | Include errors, blocked and token-limit endings. |
| `notifyOnWaiting` | `true` | Include approvals and `ask_user_question`. |
| `notifyOnGoalRounds` | `false` | Include completed intermediate rounds while a goal remains active. |
| `language` | `zh` | Simplified Chinese by default, with no configuration required. Explicit `en` selects English. Explicit `auto` reads `LC_ALL`, `LC_MESSAGES`, then `LANG`; missing/unsupported languages fall back to Simplified Chinese. The settings renderer follows a supported host UI language independently, otherwise generic Chinese metadata. |

The default does **not** inspect your environment: an English `LANG` still gives Chinese unless you explicitly choose `language: auto`. To opt into English, set `language: en`; `language: auto` with an English environment intentionally gives English. Existing explicit `en`/`auto` settings are not overwritten. `zh-CN`/`zh_TW` map to the Simplified Chinese catalog; English regional variants are accepted. Missing/empty/unsupported settings and missing translation keys fall back to Simplified Chinese. The standalone Python helper uses the same default/fallback and accepts `--locale en` or explicit `--locale auto`.

Discovery order:

1. Desktop: nonempty setting → explicitly supplied `DSH_DESKTOP_EXECUTABLE` → current host executable **only if named `DeepSeek Harness.exe`** → the known `resources/app.asar/dsh/` Host entry's installation root plus `DeepSeek Harness.exe`.
2. Python: nonempty setting → explicitly supplied `DSH_PYTHON_PATH` → `$env:DSH_HOME\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe` → `<desktop installation>\resources\runtime\python\python.exe` if that known file exists.

No `PATH` search, user-directory scan, registry inspection or dependency install. Electron's `process.execPath` is **never** used as Python. An invalid explicit value fails closed instead of silently falling back. Every result must be an existing file, not a directory. Python binary identity/version ultimately depends on the selected trusted executable; do not rename an arbitrary program to `python.exe`.

If discovery cannot establish both paths, no helper starts. Set them in the profile configuration above, for example `C:/Applications/DSH/DeepSeek Harness.exe` and `C:/Runtimes/Python/python.exe` **only if those files exist on your computer**. Drive-qualified paths and UNC shares are Windows scenarios; a POSIX path or drive-relative `C:...` path is not supported. Prefer local trusted executables to network shares. Environment variables must be supplied to the Host before it starts; changing a shell variable afterwards does not change an already running Host.
