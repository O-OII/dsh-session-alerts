/** Real offline npm pack assertions. Run via npm run test:pack; never installs or applies the plugin. */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
let files, unpacked;

before(() => {
  assert.ok(process.env.npm_execpath, 'Run this suite with npm run test:pack using an existing npm installation.');
  mkdirSync(resolve(root, 'artifacts'), { recursive: true });
  const output = mkdtempSync(resolve(root, 'artifacts', 'pack-'));
  const packed = spawnSync(process.execPath, [process.env.npm_execpath, 'pack', '--ignore-scripts', '--offline', '--pack-destination', output], {
    cwd: root, stdio: 'inherit', env: { ...process.env, npm_config_cache: resolve(output, 'npm-cache') },
  });
  assert.ifError(packed.error); assert.equal(packed.status, 0);
  const archives = readdirSync(output).filter(name => name.endsWith('.tgz'));
  assert.deepEqual(archives, [`${pkg.name}-${pkg.version}.tgz`]);
  const tar = gunzipSync(readFileSync(resolve(output, archives[0])));
  const text = (buffer) => buffer.toString('utf8').replace(/\0.*$/s, '');
  files = new Map();
  unpacked = resolve(output, 'unpacked');
  for (let offset = 0; offset + 512 <= tar.length && tar[offset] !== 0;) {
    const header = tar.subarray(offset, offset + 512);
    const prefix = text(header.subarray(345, 500));
    const name = (prefix ? `${prefix}/` : '') + text(header.subarray(0, 100));
    const size = parseInt(text(header.subarray(124, 136)).trim() || '0', 8);
    assert.ok(Number.isSafeInteger(size) && size >= 0, name);
    const type = String.fromCharCode(header[156]);
    if (type === '0' || type === '\0') {
      assert.ok(name.startsWith('package/'), name);
      const relative = name.slice('package/'.length);
      const target = resolve(unpacked, relative);
      assert.ok(target.startsWith(unpacked + sep), name);
      assert.ok(!files.has(relative), name);
      const content = tar.subarray(offset + 512, offset + 512 + size);
      files.set(relative, content);
      mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, content);
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  writeFileSync(resolve(output, 'pack-summary.json'), JSON.stringify({ version: pkg.version, files: files.size,
    icoAssets: [...files.keys()].filter(name => /^assets\/badges\/.*\.ico$/.test(name)).length,
    archive: archives[0] }, null, 2) + '\n');
});

test('real archive has version 0.1.1, both complete locales and all 100 icons without private or test artifacts', () => {
  const packed = JSON.parse(files.get('package.json').toString('utf8'));
  assert.equal(packed.version, '0.1.1'); assert.equal(packed.version, pkg.version);
  assert.match(packed.description, /任务栏数字角标/);
  assert.equal(packed.dsh.bundle.patch, './cordis.patch.yml');
  for (const name of ['index.mjs', 'config.mjs', 'i18n.mjs', 'native.py', 'locale/en.json', 'locale/zh.json',
    'cordis.patch.yml', 'LICENSE', 'README.md', 'README.zh-CN.md', 'CHANGELOG.md']) assert.ok(files.has(name), name);
  assert.equal([...files.keys()].filter(name => /^assets\/badges\/.*\.ico$/.test(name)).length, 100);
  for (const name of files.keys()) assert.doesNotMatch(name, /(^|\/)(?:artifacts|verification|test|node_modules|\.git|__pycache__)(\/|$)|runtime-status|\.log$|\.tgz$/);
});

test('unpacked runtime keeps Chinese defaults and fallbacks while preserving explicit English and auto', async () => {
  const { languageOf, translate, locales } = await import(pathToFileURL(resolve(unpacked, 'i18n.mjs')).href);
  const { defaults, createConfig } = await import(pathToFileURL(resolve(unpacked, 'config.mjs')).href);
  assert.equal(defaults.language, 'zh'); assert.equal(languageOf(undefined, { LANG: 'en' }), 'zh');
  assert.equal(languageOf('en', { LANG: 'zh' }), 'en'); assert.equal(languageOf('auto', { LANG: 'en' }), 'en');
  assert.equal(languageOf('auto', { LANG: 'fr' }), 'zh'); assert.equal(languageOf('auto', {}), 'zh');
  assert.equal(translate('fr', 'meta.title'), locales.zh.meta.title);
  assert.equal(translate('en', 'meta.title'), locales.en.meta.title);
  assert.equal(translate('en', 'messages.pipes', {}, { en: {} }), locales.zh.messages.pipes);
  const field = () => ({ default(value) { this.value = value; return this; }, description(value) { this.descriptionText = value; return this; },
    i18n(value) { this.messages = value; return this; } });
  const schema = createConfig({ boolean: field, string: field, object: dict => Object.assign(field(), { dict }) });
  assert.equal(schema.descriptionText, locales.zh.meta.description);
  assert.equal(schema.messages.en.$description, locales.en.meta.description);
  assert.equal(schema.dict.language.value, 'zh');
  assert.match(files.get('cordis.patch.yml').toString('utf8'), /language: zh\s*$/);
});

test('packed release code, locales and bilingual documentation match the audited working tree', () => {
  for (const name of [...files.keys()].filter(name => /\.(?:mjs|py|json|md|yml)$/.test(name))) {
    assert.deepEqual(files.get(name), readFileSync(resolve(root, name)), name);
  }
  assert.match(files.get('index.mjs').toString('utf8'), /version: '0\.1\.1'/);
  assert.match(files.get('native.py').toString('utf8'), /add_argument\('--locale', default='zh'\)/);
  assert.match(files.get('CHANGELOG.md').toString('utf8'), /## 0\.1\.1/);
  assert.match(files.get('README.md').toString('utf8'), /Simplified Chinese/);
  assert.match(files.get('README.zh-CN.md').toString('utf8'), /默认简体中文/);
});
