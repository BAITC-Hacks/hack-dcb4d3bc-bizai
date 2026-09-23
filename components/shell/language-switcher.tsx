"use client";
import { useState } from "react";
import { useI18n } from "@/components/providers/locale";
import { localeCookie, locales } from "@/lib/i18n";
export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const [pending, setPending] = useState(false);
  return <label className="flex shrink-0 items-center rounded-lg border border-brand-mist bg-white px-2 py-1">
    <span className="sr-only">{t("Language")}</span>
    <select aria-label={t("Language")} value={locale} disabled={pending} className="!w-auto !border-0 !bg-transparent !p-1 text-xs font-semibold text-brand-navy" onChange={event => {
      setPending(true);
      document.cookie = `${localeCookie}=${event.target.value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      // A full reload keeps server-rendered content, client messages and html[lang] in sync.
      window.location.reload();
    }}>{locales.map(value => <option key={value} value={value} lang={value}>{({ en: "ENG · English", ru: "РУС · Русский", kk: "ҚАЗ · Қазақша" })[value]}</option>)}</select>
  </label>;
}
