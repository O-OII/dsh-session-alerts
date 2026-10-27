# Documentation images

[README](../README.md) · [简体中文](images.zh-CN.md)

## Native probe captures

The README's [badge 5](images/native-badge-5.png) and [badge 4](images/native-badge-4.png) images are separately captured real Windows taskbar regions, each 210 × 48 pixels, with DSH in the foreground. They show unmodified captured pixels, not a synthetic taskbar. The helper was supplied controlled values 5 and 4 on the same DSH window; COM reported `HRESULT 0` for both. They establish native rendering for those probes, not five actual model tasks, an end-to-end read-acknowledgement transition, or a DPI/Explorer compatibility matrix. The 5 → 4 state logic has separate isolated integration-test evidence.

## Preview sources

The obsolete window-clear flow PNGs were removed in 0.2.0. The flow HTML now explains 5 → 4; regenerate a new illustration before embedding it. No native screenshot was captured by the isolated redesign tests.

| Preview | Source query | Purpose |
| --- | --- | --- |
| Bundled assets | `?view=assets&lang=en` | Reads the actual `1.ico`, `2.ico`, `12.ico`, `99plus.ico` on light/dark surfaces; lists all five embedded sizes. |
| Number states | `?view=states&lang=en` | Explains one distinct main session, twelve, and more than ninety-nine; the displayed artwork remains the original ICO. |
| Per-session read flow | `?view=flow&lang=en` | Five sessions finish → foreground A alone clears nothing → view A newest result → four remain unread. |

These are **browser-rendered asset previews and behavior diagrams, not Windows desktop screenshots or live acceptance evidence**. The cards do not imitate a taskbar. No real profile, session, window matching, COM call or Explorer interaction is used; all event names are explanatory examples.

## Reproduce

1. Use a source checkout; preview tools are not part of the minimal runtime archive.
2. Install the open-source [Noto Sans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC) font (SIL Open Font License) locally. The HTML uses `local()` only, makes no font download, and exposes `window.previewReady` with `fontLoaded`. Font files are not redistributed.
3. Open [the HTML tool](../tools/readme-preview.html) in Chromium. Append one of the queries above; use `lang=zh` for Chinese. Chinese is the default; explicit `lang=auto` follows browser language.
4. Set a **1200 × 570 CSS-pixel viewport**, device scale factor **1**, and browser zoom **100%**. Wait for `window.previewReady` to resolve, verify `fontLoaded: true`, all images decoded, and no clipped text or viewport overflow (flow arrows intentionally extend into card gaps). Capture the viewport as PNG without browser chrome.
5. Save the asset view as `docs/images/badge-assets-en.png`, states as `badge-states-en.png`, and flow as `badge-flow-en.png`; repeat with the `-zh.png` suffix for Chinese. Inspect each output before publishing. Do not add a synthetic desktop/taskbar background or imply native placement was measured.

The project SVG and numeric ICOs are loaded directly, not redesigned, recolored, or replaced by font glyphs. Noto is used only for explanatory text; the ICO digits remain font-free. Platform/browser font rasterization may differ slightly when reproducing screenshots.

## Validation boundary

Image inspection checks readability, language, original asset loading and consistency with the documented policy. It cannot establish native shell placement, DPI behavior, grouping or actual overlay clearing. For separately authorized native acceptance, see [contribution guidance](../CONTRIBUTING.md#real-windows-acceptance-manual-separate-consent).
