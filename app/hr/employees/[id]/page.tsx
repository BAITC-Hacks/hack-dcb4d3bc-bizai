import { notFound } from "next/navigation";
import Link from "next/link";
import { requireActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { DevelopmentPanel } from "@/components/career/development-panel";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireActor("hr");
  const { id } = await params;
  const { data } = repository().read();
  const employee = data.employees.find(e => e.employee_id === id);
  if (!employee) notFound();
  return <><Link href="/hr/dashboard" className="text-sm text-brand-navy">← HR overview</Link><p className="text-sm text-muted-foreground">Read-only HR inspection</p><DevelopmentPanel employee={employee} data={data}/></>;
}
