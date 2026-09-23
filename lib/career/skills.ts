import { grades, type Dataset, type Employee } from "./types";

export function effectiveSkills(employee: Employee, data: Dataset) {
  const skills = { ...employee.skills };
  const events = new Map(data.events.map(event => [event.event_id, event]));
  const records = data.history.filter(row => row.employee_id === employee.employee_id && row.status === "completed" && row.date > employee.last_review_date && row.date <= data.meta.as_of_date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.record_id.localeCompare(b.record_id));
  for (const record of records) {
    for (const gain of events.get(record.event_id)?.develops_skills ?? []) {
      const old = skills[gain.skill_id] ?? 0;
      skills[gain.skill_id] = Math.max(old, Math.min(5, old + gain.gain, gain.max_level));
    }
  }
  return skills;
}

export function development(employee: Employee, data: Dataset) {
  const skills = effectiveSkills(employee, data);
  const nextGrade = grades[Math.min(grades.indexOf(employee.grade) + 1, grades.length - 1)];
  const target = employee.career_goal ?? { target_role: employee.role, target_grade: nextGrade };
  const targetSource = employee.career_goal ? "explicit" : employee.grade === "Lead" ? "goal_unset" : "default";
  const profile = data.role_profiles.find(p => p.role === target.target_role && p.grade === target.target_grade)!;
  const names = new Map(data.skills.map(skill => [skill.skill_id, skill.name]));
  const gaps = Object.entries(profile.required_skills).map(([id, required]) => ({
    id, name: names.get(id) ?? id, level: skills[id] ?? 0, required,
    gap: Math.max(0, required - (skills[id] ?? 0)), critical: profile.critical_skills.includes(id),
  })).sort((a, b) => Number(b.critical) - Number(a.critical) || b.gap - a.gap || a.name.localeCompare(b.name));
  const total = gaps.reduce((sum, gap) => sum + gap.required, 0);
  const achieved = gaps.reduce((sum, gap) => sum + Math.min(gap.level, gap.required), 0);
  return { skills, target, targetSource, gaps, coverage: total ? Math.round(100 * achieved / total) : 100 };
}
