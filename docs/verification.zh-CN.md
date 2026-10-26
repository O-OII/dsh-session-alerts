# 开发与验证

[README](../README.zh-CN.md) · [English](verification.md)

## 离线 fake 开发测试

```powershell
node --experimental-vm-modules --test test/*.test.mjs
python -B -m unittest discover -s test -p 'test_*.py' -v
python -B tools/generate-assets.py
npm run test:pack
```

### 历史基线（本次文档整理之前）

无需 npm/pip 安装；实际打包测试需要已有 npm，以 `npm pack --ignore-scripts --offline` 运行，缓存和产物均限制在仓库 ignored `artifacts/` 内。仓库原本没有 lockfile，且无依赖，本次不新增。保留五项基础测试套件（63 JavaScript + 29 Python），以及路径发现、字段/locale 完整性、原生跨平台及配置安全失败覆盖。0.1.1 在 Windows、Node 24.21.0 / Python 3.12.14 实跑 **101 JavaScript + 42 Python + 3 项真实打包测试，全部通过，无跳过**，覆盖英文环境下默认中文、显式英文、显式 auto 优先级/回退、缺失翻译键、通用中文 schema 元数据及七个字段的双语元数据。解包后核验运行时代码的中文默认、0.1.1 版本、双语目录、100 个图标，以及排除测试/私密产物。未读取或修改现用 profile/已安装插件。Host 测试在 Linux 也模拟 Windows；所有子进程和窗口行为均为 fake。[CI](../.github/workflows/test.yml) 在 Ubuntu 与 Windows 上执行相同 fake 测试，绝不直接运行真实 helper。**Windows runner 测试成功不代表真实 Windows 任务栏验收。**截图制作/隐私边界见[贡献指南](../CONTRIBUTING.md)。

## 文档说明图

见[图片复现与范围](images.zh-CN.md)。浏览器渲染的预览不调用 COM、Explorer、现用 DSH profile 或任务栏。
