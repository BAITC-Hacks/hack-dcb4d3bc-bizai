"use client";
import { useI18n } from "@/components/providers/locale";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  return <main className="mx-auto max-w-xl space-y-5 p-10"><h1>{t("Something went wrong")}</h1><Button onClick={reset}>{t("Try again")}</Button></main>;
}
