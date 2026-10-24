/** Schemastery uses localized descriptions as field labels/help (not a separate title API). */
import { locales } from './i18n.mjs';
export const defaults = Object.freeze({ enabled: true, desktopExecutable: '', pythonPath: '',
  notifyOnError: true, notifyOnWaiting: true, notifyOnGoalRounds: false, language: 'auto' });
export function createConfig(z) {
  const fields = Object.fromEntries(Object.entries(defaults).map(([key, value]) => {
    const text = locales.en.config[key];
    return [key, (typeof value === 'boolean' ? z.boolean() : z.string()).default(value)
      .description(`${text.title} — ${text.description}`)];
  }));
  return z.object(fields).description(locales.en.meta.description).i18n(Object.fromEntries(
    Object.entries(locales).map(([language, resource]) => [language, { $description: resource.meta.description,
      ...Object.fromEntries(Object.entries(resource.config).map(([key, value]) => [key, `${value.title} — ${value.description}`])),
    }]),
  ));
}
