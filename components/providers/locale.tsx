"use client";
import { createContext, useContext, useMemo } from "react";
import { createI18n, type I18n, type Locale } from "@/lib/i18n";
const Context = createContext<I18n | null>(null);
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => createI18n(locale), [locale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useI18n() {
  const value = useContext(Context);
  if (!value) throw new Error("LocaleProvider is missing");
  return value;
}
