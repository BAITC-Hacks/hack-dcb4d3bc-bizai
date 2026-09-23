"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Compass, Database, GraduationCap, LayoutDashboard, LogOut, Menu, X, Target, History, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function WorkspaceShell({ role, name, position, date, children }: { role: "hr" | "employee"; name: string; position: string; date: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = role === "hr"
    ? [{ href: "/hr/dashboard", label: "Overview", icon: LayoutDashboard }, { href: "/hr/data", label: "Data & imports", icon: Database }]
    : [{ href: "/employee/dashboard", label: "My development", icon: LayoutDashboard }, { href: "/employee/learning", label: "Activities", icon: GraduationCap }];
  const initials = name.split(" ").slice(0, 2).map(part => part[0]).join("");
  return <div className="min-h-screen lg:flex" onKeyDown={event => { if (event.key === "Escape") setOpen(false); }}>
    {open && <button className="fixed inset-0 z-40 bg-brand-ink/40 lg:hidden" aria-label="Close navigation" onClick={() => setOpen(false)}/>}
    <aside className={cn("fixed inset-y-0 left-0 z-50 w-72 shrink-0 flex-col border-r border-brand-mist bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0", open ? "flex translate-x-0" : "hidden lg:flex")}>
      <div className="flex h-20 items-center justify-between border-b px-6">
        <Link href={links[0].href} className="flex items-center gap-3" onClick={() => setOpen(false)}><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-navy text-white"><Compass className="h-6 w-6"/></span><span className="font-bold text-brand-ink">Career Quest<span className="block text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">BizAI · Development</span></span></Link>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)}><X className="h-4 w-4"/></Button>
      </div>
      <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3 py-6"><p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{role === "hr" ? "People workspace" : "Your workspace"}</p>{links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href === "/hr/dashboard" && pathname.startsWith("/hr/employees/"));
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition", active ? "bg-brand-navy text-white shadow-sm" : "text-brand-ink/80 hover:bg-brand-mist/60")}><Icon className="h-4 w-4"/>{label}</Link>;
      })}<p className="!mt-6 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{role === "hr" ? "Insights" : "My career"}</p>{(role === "hr" ? [{label:"Employees",href:"/hr/dashboard#employees",icon:Users},{label:"Skill gaps",href:"/hr/dashboard#gaps",icon:Target},{label:"Participation",href:"/hr/dashboard#participation",icon:BarChart3}] : [{label:"Career trajectory",href:"/employee/dashboard#trajectory",icon:Compass},{label:"Skills & strengths",href:"/employee/dashboard#skills",icon:Target},{label:"Learning history",href:"/employee/dashboard#history",icon:History}]).map(({label,href,icon:Icon}) => <Link key={href} href={href} onClick={()=>setOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-brand-ink/80 hover:bg-brand-mist/60"><Icon className="h-4 w-4 text-brand-navy"/>{label}</Link>)}</nav>
      <div className="m-4 rounded-2xl bg-gradient-to-br from-brand-navy to-brand-navy-light p-5 text-white shadow-elevated"><Compass className="mb-3 h-6 w-6 text-brand-gold-light"/><p className="text-xs font-semibold uppercase tracking-widest text-brand-gold-light">Build your next chapter</p><p className="mt-2 text-sm leading-relaxed text-white/80">{role === "hr" ? "Make development needs visible. Help every employee find a path forward." : "Understand your strengths, explore opportunities, and grow with purpose."}</p><Link href={links[1].href} className="mt-4 flex items-center gap-2 text-xs font-semibold text-brand-gold-light">{role === "hr" ? "Manage your dataset" : "Explore activities"}<ArrowUpRight className="h-4 w-4"/></Link></div>
      <p className="px-6 pb-5 text-[10px] uppercase tracking-widest text-muted-foreground">Synthetic demo · {date}</p>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 border-b border-brand-mist/80 bg-white/90 backdrop-blur"><div className="flex h-20 items-center justify-between gap-3 px-4 md:px-8"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}><Menu className="h-5 w-5"/></Button><span className="rounded-full bg-brand-navy/5 px-3 py-1 text-xs font-semibold text-brand-navy">{role === "hr" ? "HR workspace" : "Employee workspace"}</span></div><div className="flex items-center gap-3"><span className="hidden h-9 w-9 items-center justify-center rounded-full bg-brand-mist text-xs font-bold text-brand-navy sm:flex">{initials}</span><div className="hidden text-sm sm:block"><p className="font-semibold">{name}</p><p className="text-xs text-muted-foreground">{position}</p></div><form action="/api/session" method="post"><input type="hidden" name="logout" value="true"/><Button variant="ghost" size="sm"><LogOut className="h-4 w-4"/><span>Switch account</span></Button></form></div></div></header>
      <main className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-8">{children}</main>
    </div>
  </div>;
}
