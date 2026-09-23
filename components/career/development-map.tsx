import { getI18n } from "@/lib/i18n/server";
import { DevelopmentFlow } from "./development-flow";
import type { Dataset, Employee } from "@/lib/career/types";
import { development, skillAssessments } from "@/lib/career/skills";
import { eligibility } from "@/lib/career/eligibility";
export async function DevelopmentMap({ employee, data, base }: { employee: Employee; data: Dataset; base: string }) {
  const { t } = await getI18n();
  const result = development(employee, data);
  const assessments = skillAssessments(employee, data);
  if (!result.target) return <section className="journey-section p-6"><h2>{t("Development map")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("Choose a role-linked comparison target to explore its requirements. Your personal goals and existing skills stay unchanged.")}</p><a className="primary-link mt-4" href={`${base}?view=plan`}>{t("Choose a comparison target")} →</a></section>;
  return <DevelopmentFlow current={{role:employee.role,grade:employee.grade}} target={{role:result.target.target_role,grade:result.target.target_grade}} gaps={result.gaps} assessmentDate={employee.last_review_date} recordedSkills={Object.keys(assessments.values)} approvedDates={Object.fromEntries([...assessments.observations].map(([id, observation]) => [id, observation.approvedAt.slice(0,10)]))} base={base} activities={data.events.map(event => ({id:event.event_id,title:event.title,reasons:eligibility(employee,event,data,result.target),gains:event.develops_skills.map(g=>({skillId:g.skill_id,gain:Math.max(0,Math.min(5,(result.skills[g.skill_id]??0)+g.gain,g.max_level)-(result.skills[g.skill_id]??0))}))}))} history={data.history.filter(h=>h.employee_id===employee.employee_id&&h.status==="completed").map(h=>({id:h.record_id,title:data.events.find(e=>e.event_id===h.event_id)?.title??h.event_id,date:h.date,skills:data.events.find(e=>e.event_id===h.event_id)?.develops_skills.map(g=>g.skill_id)??[]}))}/>;
}
