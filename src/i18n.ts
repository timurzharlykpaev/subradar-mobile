import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ru from './locales/ru.json';
import es from './locales/es.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import kk from './locales/kk.json';

export const SUPPORTED_LANGUAGES = [
  'en',
  'ru',
  'es',
  'de',
  'fr',
  'pt',
  'zh',
  'ja',
  'ko',
  'kk',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Pick the best supported language for the device — used only when the user
 * has no saved preference yet (first launch). Once `settingsStore.language`
 * is hydrated, that wins.
 *
 * Uses a lazy `require` rather than a top-level `import` so the JS bundle
 * still loads on older native binaries that don't yet ship the
 * expo-localization module (e.g. an OTA update delivered to a TestFlight build
 * cut before this dependency was added). Top-level import would throw at
 * module-load time and crash the entire app.
 */
export function getDeviceLanguage(): SupportedLanguage {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Localization = require('expo-localization');
    const tags = Localization.getLocales?.() ?? [];
    for (const tag of tags) {
      const code = (tag.languageCode ?? '').toLowerCase();
      if ((SUPPORTED_LANGUAGES as readonly string[]).includes(code)) {
        return code as SupportedLanguage;
      }
    }
  } catch {
    // Native module missing on old binaries / web / tests — fall through to 'en'.
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
    es: { translation: es },
    de: { translation: de },
    fr: { translation: fr },
    pt: { translation: pt },
    zh: { translation: zh },
    ja: { translation: ja },
    ko: { translation: ko },
    kk: { translation: kk },
  },
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
