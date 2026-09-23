import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/server/session";
import { repository } from "@/lib/server/repository";
import { canReadReview } from "@/lib/career/reviews";
import { reviewText } from "@/lib/career/review-copy";
import { getI18n } from "@/lib/i18n/server";
import { ReviewPanel } from "@/components/career/review-panel";

export default async function Page({ searchParams }: { searchParams: Promise<{ employeeId?: string }> }) {
  const actor = await requireActor("employee");
  const { locale, t } = await getI18n();
  const data = repository().read().data;
  const id = (await searchParams).employeeId ?? actor.employeeId;
  const employee = data.employees.find(e => e.employee_id === id);
  if (!employee || !canReadReview(actor, employee)) notFound();
  const reports = data.employees.filter(e => e.manager_id === actor.employeeId && e.employee_id !== actor.employeeId);
  return <><header className="page-heading"><div><p className="eyebrow">{t("Assessment evidence")}</p><h1>{reviewText(locale, "title")}</h1><p className="mt-3 page-description">{t("Document your work, assess your skills, and prepare for a review.")}</p></div></header><nav className="section-tabs" aria-label={t("Review subject")}><Link aria-current={id === actor.employeeId ? "page" : undefined} href="/employee/reviews">{reviewText(locale, "own")}</Link>{!!reports.length && <span>{reviewText(locale, "reports")}:</span>}{reports.map(e => <Link key={e.employee_id} aria-current={id === e.employee_id ? "page" : undefined} href={`/employee/reviews?employeeId=${encodeURIComponent(e.employee_id)}`}>{e.full_name}</Link>)}</nav><div className="context-strip">{employee.full_name} · {t(employee.role)} · {t(employee.grade)}</div><div className="workspace-content"><ReviewPanel key={employee.employee_id} employeeId={employee.employee_id} editable={actor.employeeId === employee.employee_id} skills={data.skills}/></div></>;
}
