import { getI18n } from "@/lib/i18n/server";
import { requireActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { ImportForm } from "@/components/career/import-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default async function Page() {
  const { t, formatDate, formatNumber } = await getI18n();
  await requireActor("hr");
  const { data, revision } = repository().read();
  return <><h1>{t("Data & imports")}</h1><p className="text-muted-foreground">{t("Dataset date")} {formatDate(data.meta.as_of_date)} {t("· revision")} {revision}</p>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[[t("Employees"), data.employees.length], [t("Activities"), data.events.length], [t("Skills"), data.skills.length], [t("History records"), data.history.length]].map(([label, count]) => <div key={label} className="rounded-xl border bg-white p-5"><p className="text-sm text-muted-foreground">{label}</p><strong className="text-2xl">{formatNumber(Number(count))}</strong></div>)}</div>
    <Card><CardHeader><CardTitle>{t("Load jury profiles and history")}</CardTitle></CardHeader><CardContent className="space-y-5"><p className="text-sm text-muted-foreground">{t("Use the supplied JSON envelope and CSV columns. Records merge by employee_id and record_id; identical records are unchanged, conflicting duplicates are rejected. References are checked against the combined dataset before an atomic commit. The snapshot date must match.")}</p><ImportForm revision={revision}/></CardContent></Card>
  </>;
}
