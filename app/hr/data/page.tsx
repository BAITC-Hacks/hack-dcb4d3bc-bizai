import { requireActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { ImportForm } from "@/components/career/import-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default async function Page() {
  await requireActor("hr");
  const { data, revision } = repository().read();
  return <><h1>Data & imports</h1><p className="text-muted-foreground">Dataset date {data.meta.as_of_date} · revision {revision}</p>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[["Employees", data.employees.length], ["Activities", data.events.length], ["Skills", data.skills.length], ["History records", data.history.length]].map(([label, count]) => <div key={label} className="rounded-xl border bg-white p-5"><p className="text-sm text-muted-foreground">{label}</p><strong className="text-2xl">{count}</strong></div>)}</div>
    <Card><CardHeader><CardTitle>Load jury profiles and history</CardTitle></CardHeader><CardContent className="space-y-5"><p className="text-sm text-muted-foreground">Use the supplied JSON envelope and CSV columns. Records merge by employee_id and record_id; identical records are unchanged, conflicting duplicates are rejected. References are checked against the combined dataset before an atomic commit. The snapshot date must match.</p><ImportForm revision={revision}/></CardContent></Card>
  </>;
}
