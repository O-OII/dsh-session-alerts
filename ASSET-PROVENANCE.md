# Code and asset provenance / 代码与资产来源

## Review scope

The authorized local source was inspected before export: README, package/patch, host entry, controller, state reducer, projection, Windows helper, five test suites, both locale catalogs, SVG icon and asset-generation script. No package dependencies, vendored notification library, third-party copyright header or copied license notice were found in that allowlist. This is a scoped source review, not a legal warranty about undisclosed history. Report any contrary attribution evidence before release; preserve the original notice and suspend distribution of the affected file while reviewed.

The maintainer explicitly authorized open-sourcing this project. The [MIT license](./LICENSE) applies to these supplied contributions and the new portability/localization/docs work, © 2026 O-OII contributors. The package's name alone was not treated as evidence of authorship.

## Artwork

- [Application SVG](./icon.svg): inspected simple vector geometry (rounded panel, three lines and a numeric circle), supplied as original local artwork. No embedded fonts, external images or trademark logo asset.
- Numeric ICOs in `assets/badges/`: **newly generated for this repository**, not copied from the previous Windows-font-rendered set. The old development script used installed Segoe UI; its glyph redistribution terms were not assumed to be MIT-compatible. Neither those rendered icons nor the font file are exported here.
- [New generator](./tools/generate-assets.py): independently hand-authored 3×5 geometric digit/plus recipes, circles and a standard ICO/DIB encoder, Python standard library only. No font files, raster icon packs, Pillow or external artwork are needed. Rebuilding produces the same 100 ICOs with 16/24/32/48/64-pixel entries.
- Windows COM interface names/GUID values are interoperability identifiers, not a bundled implementation. No Microsoft executable, font, SDK or Windows library is distributed.

## Deliberately excluded

Private verification/status records, desktop screenshots, session snapshots, backups, private integration modifications, local installation helpers and machine-specific patches are excluded. Only the independent plugin and its reviewed assets are included.

## 中文摘要

本次逐项检查了授权提供的源码白名单，未发现第三方库、版权声明或被遗漏的许可证；这不是对未公开历史的法律保证。发现相反来源证据时应立即报告并暂停分发相关文件。用户明确授权开源，MIT 归属为 2026 O-OII contributors，而非仅因包名推定原创。

旧数字资产由 Windows Segoe UI 渲染，其字体授权不作 MIT 兼容推断，因此不复制。此仓库改用全新手绘几何数字和标准库 ICO 编码器，100 项资产可确定性再生，无字体或外部图集。SVG 也已检查，无内嵌字体、外链图片或商标素材。私密验证、状态、截图、备份、快照与私有集成修改均不导出。
