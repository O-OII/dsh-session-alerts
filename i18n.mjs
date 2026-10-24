/** Own host-only namespace. English remains the generic fallback for absent translations. */
import { readFileSync } from 'node:fs';
export const NAMESPACE = 'dsh-native-taskbar-badge';
export const locales = Object.fromEntries(['en', 'zh'].map((language) => [language,
  JSON.parse(readFileSync(new URL(`./locale/${language}.json`, import.meta.url), 'utf8'))]));
export function languageOf(value = 'auto', env = process.env) {
  const selected = value === 'auto' ? (env.LC_ALL || env.LC_MESSAGES || env.LANG || 'en') : value;
  return /^zh(?:[-_]|$)/i.test(String(selected)) ? 'zh' : 'en';
}
export function translate(language, key, parameters = {}, resources = locales) {
  const get = (tree) => key.split('.').reduce((value, part) => value?.[part], tree);
  const value = get(resources[language]) ?? get(resources.en) ?? get(locales.en) ?? `${NAMESPACE}.${key}`;
  return String(value).replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(parameters, name) ? String(parameters[name]) : match);
}
