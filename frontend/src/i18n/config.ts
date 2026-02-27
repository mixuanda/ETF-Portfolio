export type AppLocale = "en" | "zh-Hans" | "zh-Hant";

export const APP_LOCALE_STORAGE_KEY = "portfolio.locale";

export const APP_LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文"
};

export const INTL_LOCALE_BY_APP_LOCALE: Record<AppLocale, string> = {
  en: "en-HK",
  "zh-Hans": "zh-CN",
  "zh-Hant": "zh-HK"
};
