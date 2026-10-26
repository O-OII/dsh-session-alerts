# Contributing / 参与开发

## Safe local development

Use Node 22+ and existing Python 3.10+. No npm/pip dependencies or network are required:

```text
node --experimental-vm-modules --test test/*.test.mjs
python -B -m unittest discover -s test -p test_*.py -v
python -B tools/generate-assets.py
npm run test:pack
```

Keep tests fake: do not instantiate the real Windows Taskbar class, touch a live DSH profile, install/uninstall a plugin, edit shortcuts/AppUserModelID/protocols, kill applications or send COM overlays as part of a unit test. Native helper entry is intentionally not a CI command. Preserve the original five suites and their behavioural coverage (63 JavaScript + 29 Python baseline), including crash/disposal, focus acknowledgement, Explorer recovery, approvals/questions, goal filtering and subagent exclusion. Add cases for any changed event shape or discovery path.

Windows GUID layout uses fixed-width ctypes, because Linux's `wintypes.DWORD` can have a different size. Fake Host tests explicitly inject Windows platform/path/file services on every OS; no real helper is spawned. CI checks Windows and Linux **fake** logic only.

## Internationalization

[English](./locale/en.json) and [Chinese](./locale/zh.json) catalogs must have identical leaf keys and interpolation names. Keep the package-owned namespace `dsh-native-taskbar-badge`; never register strings under another plugin's namespace. This host-only plugin does not import a client locale service. [Schema metadata](./config.mjs) explicitly consumes `config` catalog fields using the official [Schemastery i18n contract](https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/schemastery/src/index.ts): localized description includes a human-friendly label and explanation; a Simplified Chinese description is the generic default/fallback while explicit English descriptions remain available. Plugin manager `meta.title`/`meta.description` are exported through the package locale convention, separate from schema fields.

Diagnostic language is selected independently by `language`, defaulting to `zh` without consulting environment variables. Preserve explicit `en` and opt-in `auto` (LC_ALL → LC_MESSAGES → LANG), falling back to Simplified Chinese for absent/unsupported locales and missing translation keys. Keep JS and Python resolution consistent; low-level OS/provider/standard-library errors are preserved rather than misleadingly translated. New messages must have Simplified Chinese fallback and a matching English catalog entry. Real packaging tests use an existing npm offline and confine archive/cache/extraction to ignored `artifacts/`; they do not install anything. Do not persist session titles/content as a debugging convenience.

## Real Windows acceptance (manual, separate consent)

Before claiming a release is desktop-verified, use an isolated, privacy-free Windows environment with a **dedicated synthetic application window and fake sessions**. Do not target an existing personal DSH window, change a live profile or force-close applications merely to obtain a demonstration. A maintainer can separately consent to a dedicated disposable DSH test profile/environment.

Record OS/DSH/Node/Python versions, taskbar mode, display scaling, exact test scope and whether any calls were mocked. Verify:

- 1, 2 and 99+ rendering and foreground clearing;
- no replay after blur, no child-agent counts, approval/question resolution and goal-round filtering;
- exact executable rejection of foreign windows, ambiguity refusal;
- disable/uninstall clearing and zero remaining owned helpers;
- helper crash retry limit and Explorer recreation recovery, **only in an isolated environment where this is safe**;
- no sound, Toast, focus steal or identity/shortcut/protocol changes.

The original deployment's probes are not proof that the new font-free artwork or removed helper AppUserModelID call has the same visual result. Do not infer live coverage from CI's Windows runner.

## Screenshot preparation

This project ships no actual desktop screenshot. To prepare one later, arrange a clean disposable desktop, synthetic names/counts and a dedicated test app; hide/redact unrelated apps, wallpaper details, personal paths, account names and clocks if identifying. Capture enough native taskbar context to prove placement. Label the OS, scaling and capture scope. Review the image independently before publication.

An artwork preview/diagram made from the included icons is welcome, but visibly label **“Illustration — not an actual desktop screenshot / 示意图，非实际桌面截图”** in the image and caption. A collage of tiny test icons is not evidence of GUI operation. Do not publish the local source's historical screenshots or verification artifacts.

## Contributions and licensing

Submit small patches and actual test output. Do not publish secrets, profiles, private screenshots or machine-specific paths. Document any third-party code/artwork source and its compatible license before adding it; stop if ownership cannot be established. Contributions are under [MIT](./LICENSE). No repository creation, commit, push or registry publication is necessary for local preparation.

## 中文摘要

测试仅 fake、离线，不操作现用任务栏/profile，不为演示杀应用，不改快捷方式、AppUserModelID、协议。保留五套基础测试覆盖，新路径/locale/config 变更需补测。英文/中文目录字段及参数必须一致，schema 使用官方 `.i18n`，通用默认/回退为简体中文，同时保留显式英文。默认 `zh` 不读取环境；显式 `en`/`auto` 必须保留，缺失语言或翻译键回退简体中文；JS/Python 规则保持一致。实际 pack 测试仅使用已有 npm 离线打包，缓存/解包均在 ignored `artifacts/`，不执行安装。真实 Windows 验收需另行授权的隔离无隐私环境，尤其不能把 Windows CI fake 测试当作 live 验证。

真实截图之后单独安排：使用合成无隐私窗口及假会话，保留足够任务栏上下文，注明 OS/DPI/范围。用原创资产生成的图必须醒目标记“示意图，非实际桌面截图”，不复制旧验证截图。提交前核对来源与 MIT 兼容性，不上传凭据、私密快照或个人路径。
