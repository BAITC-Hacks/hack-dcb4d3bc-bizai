import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { LocaleProvider } from "@/components/providers/locale";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: "Career Quest · BizAI", description: t("Employee development, skills and career trajectories") };
}
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const { locale } = await getI18n();
  return <html lang={locale}><body><LocaleProvider locale={locale}>{children}</LocaleProvider></body></html>;
}
