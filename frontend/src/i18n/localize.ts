import type { Locale } from "./translations";

export function localize(locale: Locale, vi: string, en: string) {
  return locale === "vi" ? vi : en;
}
