# Windows 路径与设置

[README](../README.zh-CN.md) · [English](configuration.md)

本版本没有独立可视化设置页。需要修改时，请将下面的值合并到当前 profile 的 `cordis.patch.yml` 配置中，保留自己已有的提醒偏好；不要再插入第二个插件实例。

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

路径仅为格式示例，必须替换成本机实际存在的文件。

## 跨机器 Windows 路径配置

独立[安装 patch](../cordis.patch.yml)不含个人绝对路径。默认留空表示有边界的发现，不表示猜窗口。

| 设置 | 默认 | 含义 |
| --- | --- | --- |
| `enabled` | `true` | 启动 helper；停用时清理进程及其最后设置的覆盖图标。 |
| `desktopExecutable` | 空 | 精确 DSH 桌面 exe 的现有 Windows 绝对路径，不是 `dsh.cmd`、node 或 Python。 |
| `pythonPath` | 空 | 已有 Python 3.10+ `python.exe` 的 Windows 绝对路径；接受带版本数字的 Python 文件名，不接受 `pythonw.exe`。 |
| `notifyOnError` | `true` | 计入失败、阻塞及输出超限。 |
| `notifyOnWaiting` | `true` | 计入待审批与 `ask_user_question`。 |
| `notifyOnGoalRounds` | `false` | 是否计入活动目标自动推进的已完成中间回合。 |
| `language` | `zh` | 默认简体中文，无需额外配置。显式 `en` 选择英文；显式 `auto` 依次读取 `LC_ALL`、`LC_MESSAGES`、`LANG`，缺失或不支持的语言回退简体中文。设置元数据独立跟随受支持的宿主界面语言，否则使用通用中文元数据。 |

默认**不读取环境语言**：即使 `LANG` 为英文仍显示中文。需要英文可设 `language: en`；只有显式 `language: auto` 才跟随环境，因此英文环境下 auto 显示英文是预期行为。已有显式 `en`/`auto` 配置不会被覆盖。`zh-CN`/`zh_TW` 均使用简体中文目录，英文区域变体也受支持；缺失、空值、不支持的配置及缺失翻译键均回退简体中文。独立 Python helper 使用同样默认与回退，可显式传入 `--locale en` 或 `--locale auto`。资产预览页也默认中文，保留 `?lang=en`，可用 `?lang=auto` 显式跟随浏览器。

发现顺序：

1. 桌面：非空设置 → 显式提供的 `DSH_DESKTOP_EXECUTABLE` → 当前宿主 exe（**仅当文件名为 `DeepSeek Harness.exe`**）→ 已知 `resources/app.asar/dsh/` Host 入口对应安装根目录下的 `DeepSeek Harness.exe`。
2. Python：非空设置 → 显式提供的 `DSH_PYTHON_PATH` → `$env:DSH_HOME\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe` → `<桌面安装目录>\resources\runtime\python\python.exe`（若确实存在）。

不搜索 `PATH`、不扫描用户私目录、不查注册表、不装依赖；**绝不把 Electron 的 `process.execPath` 当作 Python**。显式值无效时直接关闭该能力，不默默改用其他程序。必须是文件，不能是目录。Python 的真实身份/版本最终依赖用户选择的可信程序，不要把任意程序改名为 `python.exe`。

无法确定两项路径时不启动 helper，请在上述 profile 配置中填本机实际存在的路径，例如 `C:/Applications/DSH/DeepSeek Harness.exe`、`C:/Runtimes/Python/python.exe`，这些仅是格式示例。支持盘符绝对路径和 UNC Windows 路径；不支持 POSIX 或 `C:...` 盘符相对路径。建议本地可信程序而非网络共享。环境变量需在 Host 启动前提供，后来修改某个 shell 的变量不会改变已运行 Host。
