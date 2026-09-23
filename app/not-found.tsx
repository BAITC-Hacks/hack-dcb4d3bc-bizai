import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
export default async function NotFound() {
  const { t } = await getI18n();
  return <main className="mx-auto max-w-xl space-y-5 p-10"><h1>{t("Page not found")}</h1><Link className="text-brand-navy underline" href="/">{t("Return to the portal")}</Link></main>;
}
