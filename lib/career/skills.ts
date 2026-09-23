import { type Dataset, type Employee } from "./types";

export function effectiveSkills(employee: Employee, data: Dataset) {
  const skills = { ...employee.skills };
  const events = new Map(data.events.map(event => [event.event_id, event]));
  const demoIds = new Set(data.demo_completions?.map(row => row.id) ?? []);
  const records = data.history.filter(row => !demoIds.has(row.record_id) && row.employee_id === employee.employee_id && row.status === "completed" && row.date > employee.last_review_date && row.date <= data.meta.as_of_date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.record_id.localeCompare(b.record_id));
  for (const record of records) {
    for (const gain of events.get(record.event_id)?.develops_skills ?? []) {
      const old = skills[gain.skill_id] ?? 0;
      skills[gain.skill_id] = Math.max(old, Math.min(5, old + gain.gain, gain.max_level));
    }
  }
  // Application completions occur after the imported snapshot; operational time
  // never competes with the synthetic business clock or its date-only cutoff.
  for (const completion of data.demo_completions ?? []) {
    if (completion.employee_id !== employee.employee_id) continue;
    for (const gain of completion.gains) {
      const old = skills[gain.skill_id] ?? 0;
      skills[gain.skill_id] = Math.max(old, Math.min(5, old + gain.gain, gain.max_level));
    }
  }
  return skills;
}

export function development(employee: Employee, data: Dataset) {
  const skills = effectiveSkills(employee, data);
  const target = employee.career_goal;
  const targetSource = target ? "explicit" : "goal_unset";
  const profile = target ? data.role_profiles.find(p => p.role === target.target_role && p.grade === target.target_grade) : null;
  const names = new Map(data.skills.map(skill => [skill.skill_id, skill.name]));
  const gaps = Object.entries(profile?.required_skills ?? {}).map(([id, required]) => ({
    id, name: names.get(id) ?? id, level: skills[id] ?? 0, required,
    assessed: employee.skills[id] ?? 0, closed: (employee.skills[id] ?? 0) >= required,
    gap: Math.max(0, required - (skills[id] ?? 0)), critical: profile!.critical_skills.includes(id),
  })).sort((a, b) => Number(b.critical) - Number(a.critical) || b.gap - a.gap || a.name.localeCompare(b.name));
  const closed = gaps.filter(gap => gap.closed).length;
  return { skills, target, targetSource, gaps, closed, coverage: gaps.length ? Math.round(100 * closed / gaps.length) : null };
}
