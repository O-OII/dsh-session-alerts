# Development and verification

[README](../README.md) · [简体中文](verification.zh-CN.md)

## Develop and verify (offline, fake only)

```powershell
node --experimental-vm-modules --test test/*.test.mjs
python -B -m unittest discover -s test -p 'test_*.py' -v
python -B tools/generate-assets.py
npm run test:pack
```

### Historical baseline (before this documentation refresh)

There is nothing to install with npm/pip; the real packaging suite requires an existing npm and runs `npm pack --ignore-scripts --offline` with its cache/output confined to ignored `artifacts/`. No lockfile existed in this dependency-free repository, and none is required or added. Five original test suites are retained (63 JavaScript + 29 Python baseline cases), with path discovery, metadata/catalog, native portability and fail-closed configuration coverage. Version 0.1.1 checks on Windows with Node 24.21.0 / Python 3.12.14 passed **101 JavaScript + 42 Python + 3 real-pack tests**, with no failures or skipped cases. These include Chinese defaults under an English environment, explicit English, opt-in auto priority/fallback, missing translation keys, generic Chinese schema metadata and all seven English/Chinese localized fields. The archive is unpacked to validate its runtime defaults, 0.1.1 version, both catalogs, all 100 icons and exclusion of test/private artifacts. No live profile or installed plugin was read or changed. The host test simulates Windows even on Linux; all subprocess and window operations are fakes. [CI](../.github/workflows/test.yml) runs those same fake suites on Ubuntu and Windows, never the live native helper. A Windows CI runner **does not** count as live Windows taskbar acceptance. See [contribution guidance](../CONTRIBUTING.md) for evidence boundaries and screenshot preparation.

## Documentation illustrations

See [image reproduction and scope](images.md). Browser-rendered previews do not exercise COM, Explorer, a live DSH profile or the taskbar.
