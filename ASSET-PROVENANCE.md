# Code and asset provenance / 代码与资产来源

## Project licensing

The maintainer authorized open-sourcing this project. The [MIT license](./LICENSE) covers the supplied project contributions and independently authored implementation/artwork, © 2026 O-OII contributors. The scoped source review is not a legal warranty about undisclosed history: report contrary attribution evidence and preserve original notices before redistribution.

## Rounded artwork — 0.2.2

- [Numeric generator](./tools/generate-assets.py): independently authored cubic-Bezier digit/plus paths, round stroke ends/joins, circular single-number background and capsule multi-character background. **No font glyphs or outlines were copied or traced.** The paths are readable coordinate data in this repository, not a renamed font or bitmap font.
- All 100 ICOs are regenerated from those original paths: `1`–`99`, then `99+`. Every icon contains separate **16, 24, 32, 48 and 64 px** 32-bit straight-alpha DIB entries with transparent surroundings. Each size is rasterized independently at 8× resolution and LANCZOS-downsampled. The former 3×5 block-digit recipes are no longer used.
- **No system/private font, font file, font-derived glyph outline or third-party icon pack is bundled.** No font license/redistribution assumption is needed for the new numerals.
- [Pillow](https://python-pillow.org/) **12.3.0** is a pinned **development-only rendering dependency**, declared in [artwork requirements](./tools/requirements-assets.txt). It rasterizes our geometry; it contributes no font or icon design. Its source/license is maintained by the [Pillow project](https://github.com/python-pillow/Pillow/blob/main/LICENSE). Pillow is not vendored or declared as a package runtime dependency, and the installed Windows helper still uses only the Python standard library.
- The ICO/DIB encoder remains project-authored standard-format interoperability code. Windows COM interface names/GUIDs are interoperability identifiers; no Windows executable, SDK library or Microsoft font is distributed.
- [Application SVG](./icon.svg) is the previously reviewed simple supplied geometry, unchanged by the numeric-artwork redesign. No embedded fonts or external images.

## Completion/sidebar interoperability and isolated SDK source

Completion accounting is independently implemented against the official Agent consumed-work contract and checked against the actual exported `foldConsumedWork` oracle. Strict goal replay is imported from the installed official Goal definition, not copied or relaxed. Sidebar code contributes only through the explicit workspace API v1.

The separately user-authorized `compat/workspace-sdk` subtree retains a pinned upstream MIT workspace baseline with its original LICENSE/NOTICE and hash audit. It is not claimed as newly authored SDK code or an upstream release, and is excluded from the main plugin npm archive. Its own README/legal notices describe reproducible generation. Sidebar factories are generated from shared project source and do not bundle an SDK implementation.

中文：完成记账独立实现并与官方导出oracle对照，严格goal复用已安装SDK定义；隔离compat工程保留上游MIT来源、许可证、NOTICE及哈希审计，不冒称原创SDK或上游正式版，也不进入主npm包。侧栏factory只含本项目贡献代码。

## Reproduction and evidence

Provision `python -m pip install -r tools/requirements-assets.txt` in a development environment, then run `python -B tools/generate-assets.py` offline. Pinning Pillow avoids silent renderer-version changes; CI regenerates and checks committed bytes. `--candidate --output <directory> --preview <png>` creates `1`, `5`, `12` and `99+` ICOs plus a developer comparison containing native 16 px and actual 32→16 reductions. A preview is **not** a Windows screenshot or proof of shell placement.

The separately captured native taskbar images are documented in [image provenance](./docs/images.md). Controlled probe values prove native rendering only, not real model-task counts or end-to-end unread acknowledgement. Legacy asset preview PNGs, where retained for historical comparison, must not be described as the current rounded artwork. The public HTML tools load the current ICO files directly.

Private status records, profiles, session snapshots, backups, credentials and machine-specific integration patches remain excluded.

## 中文

0.2.2 数字由本仓库独立手绘的三次贝塞尔路径生成，圆润笔画、圆端连接、单数字圆底、双位/99+ 胶囊底，外围透明；不再采用 3×5 块状字。没有复制或描摹字体字形/轮廓，不携带系统字体、用户私有字体或第三方图标包。100 个 ICO 各含 16/24/32/48/64 五种独立渲染的 32 位直通 Alpha DIB；8 倍超采样后以 LANCZOS 缩小。

Pillow 12.3.0 仅为固定版本的**开发绘制依赖**，只栅格化自有几何，不提供字形设计；不随运行包 vendoring、不列为运行依赖，原生 helper 仍仅依赖 Python 标准库。项目代码/原创路径沿用 MIT，Pillow 自身许可见上游链接，不把第三方库冒称为项目原创。应用 SVG 未改。候选预览包含真实 16px 和 32→16 缩小对照，但不能冒充实机截图；受控原生截图也不代表模型任务或已读全链路验收。私密 profile、状态、快照及凭据不导出。
