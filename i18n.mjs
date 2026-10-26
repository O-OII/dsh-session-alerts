/** Own host-only namespace. Simplified Chinese is the default and translation fallback. */
import { readFileSync } from 'node:fs';
export const NAMESPACE = 'dsh-native-taskbar-badge';
export const locales = Object.fromEntries(['en', 'zh'].map((language) => [language,
  JSON.parse(readFileSync(new URL(`./locale/${language}.json`, import.meta.url), 'utf8'))]));
export function languageOf(value = 'zh', env = process.env) {
  const selected = value === 'auto' ? (env.LC_ALL || env.LC_MESSAGES || env.LANG || 'zh') : value;
  return /^en(?:[-_.]|$)/i.test(String(selected)) ? 'en' : 'zh';
}
export function translate(language, key, parameters = {}, resources = locales) {
  const get = (tree) => key.split('.').reduce((value, part) => value?.[part], tree);
  const value = get(resources[languageOf(language)]) ?? get(resources.zh) ?? get(locales.zh) ?? `${NAMESPACE}.${key}`;
  return String(value).replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(parameters, name) ? String(parameters[name]) : match);
}
