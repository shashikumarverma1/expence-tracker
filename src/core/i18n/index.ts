import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './translations/en.json';
import hi from './translations/hi.json';

const deviceLanguage =
    Localization.getLocales()[0]?.languageCode ?? 'en';

i18n
    .use(initReactI18next)
    .init({
        compatibilityJSON: 'v3', // Required for React Native
        resources: {
            hi: { translation: hi },
            en: { translation: en },

        },
        lng: deviceLanguage,        // Auto-detect device language
        fallbackLng: 'en',          // Fallback if language not found
        interpolation: {
            escapeValue: false,       // React Native handles escaping
        },
    });

export default i18n;