import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
test('schema i18n uses correct root and field descriptions, retaining generic English fallback', () => {
  const schema = createConfig(z);
  assert.deepEqual(Object.keys(schema.dict).sort(), Object.keys(defaults).sort());
  for (const [key, field] of Object.entries(schema.dict)) {
    assert.equal(field.meta.default, defaults[key]);
    assert.match(field.meta.description, new RegExp(locales.en.config[key].title.replace(/[()]/g, '\\$&')));
    assert.equal(schema.messages.en[key], `${locales.en.config[key].title} — ${locales.en.config[key].description}`);
    assert.equal(schema.messages.zh[key], `${locales.zh.config[key].title} — ${locales.zh.config[key].description}`);
  }
  assert.equal(schema.messages.en.$description, locales.en.meta.description);
  assert.equal(schema.messages.zh.$description, locales.zh.meta.description);
  assert.equal(schema.meta.description, locales.en.meta.description);
});
test('portable defaults contain no personal paths and safe feature defaults remain unchanged', () => {
  assert.equal(defaults.desktopExecutable, ''); assert.equal(defaults.pythonPath, '');
  assert.equal(defaults.notifyOnGoalRounds, false); assert.equal(defaults.notifyOnError, true);
  assert.equal(defaults.notifyOnWaiting, true); assert.equal(defaults.language, 'auto');
});
test('language selection supports zh-CN/zh_TW and unknown languages fall back to English', () => {
  for (const value of ['zh', 'zh-CN', 'zh_TW']) assert.equal(languageOf(value, {}), 'zh');
  assert.equal(languageOf('auto', { LC_ALL: 'zh_CN.UTF-8', LANG: 'en' }), 'zh');
  for (const value of ['fr', '', 'auto', null]) assert.equal(languageOf(value, {}), 'en');
});
test('missing language or key uses English fallback without leaking another plugin namespace', () => {
  assert.equal(translate('fr', 'meta.title'), locales.en.meta.title);
  assert.equal(translate('zh', 'messages.pipes', {}, { en: { messages: { pipes: 'fallback' } }, zh: {} }), 'fallback');
  assert.equal(translate('zh', 'unknown.key'), `${NAMESPACE}.unknown.key`);
  assert.match(translate('en', 'messages.configuration', { field: 'pythonPath' }), /pythonPath.*No helper was started/);
  assert.match(translate('zh', 'messages.configuration', { field: 'pythonPath' }), /pythonPath.*未启动/);
});
test('public package declares standalone bundle, explicit host range and MIT license', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.name, 'dsh-native-taskbar-badge'); assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.engines.dsh, '>=0.2.1-rc.2 <0.3.0');
  assert.equal(pkg.repository.url, 'https://github.com/O-OII/dsh-native-taskbar-badge.git');
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml');
  const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
  assert.ok(patch.includes("name: 'dsh-native-taskbar-badge'"));
  assert.doesNotMatch(patch, /[A-Z]:[\\/]/i);
  for (const file of ['paths.mjs', 'config.mjs', 'i18n.mjs', 'LICENSE', 'README.zh-CN.md']) assert.ok(pkg.files.includes(file), file);
});
