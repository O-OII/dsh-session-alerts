import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createConfig, defaults } from '../config.mjs';
import { NAMESPACE, locales, languageOf, translate } from '../i18n.mjs';

const flatten = (tree, prefix = '') => Object.entries(tree).flatMap(([key, value]) => typeof value === 'object'
  ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]]);
function fakeSchema(dict = undefined) {
  return { dict, meta: {}, default(value) { this.meta.default = value; return this; },
    description(value) { this.meta.description = value; return this; },
    i18n(messages) { this.messages = messages; return this; } };
}
const z = { boolean: () => fakeSchema(), string: () => fakeSchema(), object: fields => fakeSchema(fields) };

test('locale namespace is package-owned and both complete catalogs have identical leaf keys', () => {
  assert.equal(NAMESPACE, 'dsh-native-taskbar-badge');
  const en = flatten(locales.en), zh = flatten(locales.zh);
  assert.deepEqual(en.map(([key]) => key).sort(), zh.map(([key]) => key).sort());
  for (const [key, value] of [...en, ...zh]) assert.ok(typeof value === 'string' && value.trim(), key);
});
test('translations preserve interpolation parameters in every namespace', () => {
  const zh = new Map(flatten(locales.zh));
  for (const [key, value] of flatten(locales.en)) {
    const params = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(params(value), params(zh.get(key)), key);
  }
});
test('all settings have English and Chinese display labels plus descriptions', () => {
  for (const resource of Object.values(locales)) {
    assert.deepEqual(Object.keys(resource.config).sort(), Object.keys(defaults).sort());
    for (const setting of Object.values(resource.config)) { assert.ok(setting.title); assert.ok(setting.description); }
  }
});
test('schema i18n retains explicit English while generic root and field descriptions default to Chinese', () => {
  const schema = createConfig(z);
  assert.deepEqual(Object.keys(schema.dict).sort(), Object.keys(defaults).sort());
  for (const [key, field] of Object.entries(schema.dict)) {
    assert.equal(field.meta.default, defaults[key]);
    assert.equal(field.meta.description, `${locales.zh.config[key].title} — ${locales.zh.config[key].description}`);
    assert.equal(schema.messages.en[key], `${locales.en.config[key].title} — ${locales.en.config[key].description}`);
    assert.equal(schema.messages.zh[key], `${locales.zh.config[key].title} — ${locales.zh.config[key].description}`);
  }
  assert.equal(schema.messages.en.$description, locales.en.meta.description);
  assert.equal(schema.messages.zh.$description, locales.zh.meta.description);
  assert.equal(schema.meta.description, locales.zh.meta.description);
});
test('portable defaults contain no personal paths and safe feature defaults remain unchanged', () => {
  assert.deepEqual(defaults, { enabled: true, desktopExecutable: '', pythonPath: '',
    notifyOnGoalRounds: false, notifyOnError: true, notifyOnWaiting: true, language: 'zh' });
});
test('default, empty and unsupported languages select Chinese even with an English environment', () => {
  for (const value of [undefined, null, '', 'fr', 'ja-JP', 'C', 'C.UTF-8']) {
    assert.equal(languageOf(value, { LANG: 'en_US.UTF-8' }), 'zh');
  }
  assert.equal(languageOf(), 'zh');
  for (const value of ['zh', 'zh-CN', 'zh_TW']) assert.equal(languageOf(value, {}), 'zh');
});
test('explicit English remains available and is independent of the environment', () => {
  for (const value of ['en', 'en-US', 'en_GB.UTF-8', 'en.UTF-8', 'EN']) {
    assert.equal(languageOf(value, { LANG: 'zh_CN.UTF-8' }), 'en');
  }
});
test('explicit auto preserves LC_ALL then LC_MESSAGES then LANG priority with Chinese fallback', () => {
  const cases = [
    [{ LC_ALL: 'zh_CN.UTF-8', LC_MESSAGES: 'en', LANG: 'en' }, 'zh'],
    [{ LC_ALL: 'en_US.UTF-8', LC_MESSAGES: 'zh', LANG: 'zh' }, 'en'],
    [{ LC_ALL: '', LC_MESSAGES: 'en_GB.UTF-8', LANG: 'zh' }, 'en'],
    [{ LANG: 'en' }, 'en'], [{ LANG: 'zh_TW' }, 'zh'],
    [{ LC_ALL: 'fr', LANG: 'en' }, 'zh'], [{ LANG: 'C.UTF-8' }, 'zh'], [{}, 'zh'],
  ];
  for (const [env, expected] of cases) assert.equal(languageOf('auto', env), expected);
});
test('missing or unsupported translation language uses Chinese, with explicit English retained', () => {
  for (const language of [undefined, null, '', 'fr']) assert.equal(translate(language, 'meta.title'), locales.zh.meta.title);
  assert.equal(translate('en', 'meta.title'), locales.en.meta.title);
  assert.equal(translate('en-US', 'meta.title'), locales.en.meta.title);
});
test('missing translation keys use supplied then built-in Chinese, not English', () => {
  const partial = { en: { messages: { pipes: 'English must not be the fallback' } }, zh: { messages: { pipes: '中文回退' } } };
  assert.equal(translate('en', 'messages.pipes', {}, { ...partial, en: {} }), '中文回退');
  assert.equal(translate('fr', 'messages.pipes', {}, partial), '中文回退');
  assert.equal(translate('en', 'messages.pipes', {}, { en: {} }), locales.zh.messages.pipes);
  assert.equal(translate('zh', 'unknown.key'), `${NAMESPACE}.unknown.key`);
  assert.match(translate('en', 'messages.configuration', { field: 'pythonPath' }), /pythonPath.*No helper was started/);
  assert.match(translate('zh', 'messages.configuration', { field: 'pythonPath' }), /pythonPath.*未启动/);
});
test('public package declares version 0.2.2, standalone bundle, explicit host range and MIT license', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.name, 'dsh-native-taskbar-badge'); assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.version, '0.2.2');
  assert.equal(pkg.engines.dsh, '>=0.2.1-rc.2 <0.3.0');
  assert.equal(pkg.repository.url, 'https://github.com/O-OII/dsh-native-taskbar-badge.git');
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
  assert.match(pkg.description, /原生.*任务栏数字角标/);
  const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
  assert.ok(patch.includes("name: 'dsh-native-taskbar-badge'"));
  assert.match(patch, /language: zh\s*$/);
  assert.doesNotMatch(patch, /[A-Z]:[\\/]/i);
  for (const file of ['paths.mjs', 'config.mjs', 'i18n.mjs', 'LICENSE', 'README.zh-CN.md']) assert.ok(pkg.files.includes(file), file);
});

function preview(search, language = 'en-US') {
  const html = readFileSync(new URL('../tools/preview-assets.html', import.meta.url), 'utf8');
  const elements = Object.fromEntries(['kicker', 'title', 'intro', 'features', 'warning'].map(id => [id, {
    textContent: '', replaceChildren(...children) { this.children = children; },
  }]));
  const images = Array.from({ length: 4 }, () => ({}));
  const document = { documentElement: { lang: /<html lang="([^"]+)"/.exec(html)[1] },
    getElementById: id => elements[id], createElement: () => ({}), querySelectorAll: () => images };
  vm.runInNewContext(/<script>([\s\S]*?)<\/script>/.exec(html)[1], { document, location: { search }, navigator: { language }, URLSearchParams });
  return { document, elements, html, images };
}
test('asset preview defaults and unknown/absent locale stay Chinese even in an English browser', () => {
  for (const search of ['', '?lang=', '?lang=fr', '?lang=zh']) {
    const result = preview(search);
    assert.equal(result.document.documentElement.lang, 'zh-CN');
    assert.match(result.html, /<title>原生角标资产预览/);
    assert.match(result.html, /alt="角标 1"/);
  }
});
test('asset preview retains explicit English and opt-in browser auto with Chinese fallback', () => {
  for (const [search, browser, expected] of [['?lang=en', 'zh-CN', 'en'], ['?lang=auto', 'en-US', 'en'],
    ['?lang=auto', 'zh-CN', 'zh-CN'], ['?lang=auto', 'fr', 'zh-CN']]) {
    const result = preview(search, browser);
    assert.equal(result.document.documentElement.lang, expected);
    if (expected === 'en') { assert.match(result.document.title, /Native badge/); assert.equal(result.images[0].alt, 'Badge 1'); }
  }
});
