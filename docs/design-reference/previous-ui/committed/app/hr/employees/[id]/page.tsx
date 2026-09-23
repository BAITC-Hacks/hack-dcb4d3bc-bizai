import { getI18n } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { DevelopmentPanel } from "@/components/career/development-panel";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { t } = await getI18n();
  await requireActor("hr");
  const { id } = await params;
  const { data } = repository().read();
  const employee = data.employees.find(e => e.employee_id === id);
  if (!employee) notFound();
  return <><Link href="/hr/dashboard" className="text-sm text-brand-navy">{t("← HR overview")}</Link><p className="text-sm text-muted-foreground">{t("Read-only HR inspection")}</p><DevelopmentPanel employee={employee} data={data}/></>;
}
