import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  APP_LOCALE_LABELS,
  APP_LOCALE_STORAGE_KEY,
  INTL_LOCALE_BY_APP_LOCALE,
  type AppLocale
} from "./config";
import { messages } from "./messages";
import { setFormatLocale } from "../utils/format";

type MessageValues = Record<string, string | number>;

interface I18nContextValue {
  locale: AppLocale;
  intlLocale: string;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, values?: MessageValues) => string;
  localeLabels: Record<AppLocale, string>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function isAppLocale(value: string): value is AppLocale {
  return value === "en" || value === "zh-Hans" || value === "zh-Hant";
}

function detectBrowserLocale(): AppLocale {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const language = navigator.language.toLowerCase();
  if (language.startsWith("zh-cn") || language.startsWith("zh-sg")) {
    return "zh-Hans";
  }
  if (
    language.startsWith("zh-hk") ||
    language.startsWith("zh-tw") ||
    language.startsWith("zh-mo")
  ) {
    return "zh-Hant";
  }

  return "en";
}

function getInitialLocale(): AppLocale {
  if (typeof window === "undefined") {
    return "en";
  }

  const saved = window.localStorage.getItem(APP_LOCALE_STORAGE_KEY);
  if (saved && isAppLocale(saved)) {
    return saved;
  }

  return detectBrowserLocale();
}

function interpolate(template: string, values?: MessageValues): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    if (Object.hasOwn(values, key)) {
      return String(values[key]);
    }
    return `{${key}}`;
  });
}

export function I18nProvider({ children }: { children: ReactNode }): JSX.Element {
  const [locale, setLocaleState] = useState<AppLocale>(getInitialLocale);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(APP_LOCALE_STORAGE_KEY, locale);
    }
    document.documentElement.lang = locale;
    setFormatLocale(INTL_LOCALE_BY_APP_LOCALE[locale]);
  }, [locale]);

  const t = useCallback(
    (key: string, values?: MessageValues): string => {
      const localized = messages[locale]?.[key];
      const fallback = messages.en[key];
      const template = localized ?? fallback ?? key;
      return interpolate(template, values);
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      intlLocale: INTL_LOCALE_BY_APP_LOCALE[locale],
      setLocale,
      t,
      localeLabels: APP_LOCALE_LABELS
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
