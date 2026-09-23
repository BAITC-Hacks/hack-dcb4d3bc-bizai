"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Compass, Database, GraduationCap, LayoutDashboard, LogOut, Menu, X, Target, History, Users, BarChart3, Sparkles, ClipboardCheck } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "@/components/providers/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function WorkspaceShell({ role, name, position, date, children }: { role: "hr" | "employee"; name: string; position: string; date: string; children: React.ReactNode }) {
  const { t, formatDate } = useI18n();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get("view") ?? "overview";
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) closeRef.current?.focus(); }, [open]);
  const close = () => { setOpen(false); menuRef.current?.focus(); };
  const links = role === "hr" ? [
    { href:"/hr/dashboard",label:"People",icon:Users },
    { href:"/hr/dashboard?view=gaps",label:"Skill gaps",icon:Target },
    { href:"/hr/dashboard?view=participation",label:"Participation",icon:BarChart3 },
    { href:"/hr/data",label:"Data & imports",icon:Database }
  ] : [
    { href:"/employee/dashboard",label:"Overview",icon:LayoutDashboard },
    { href:"/employee/dashboard?view=plan",label:"My plan",icon:Target },
    { href:"/employee/dashboard?view=advisor",label:"Development advisor",icon:Sparkles },
    { href:"/employee/dashboard?view=skills",label:"Development map",icon:BarChart3 },
    { href:"/employee/learning",label:"Activities",icon:GraduationCap },
    { href:"/employee/reviews",label:"Reviews",icon:ClipboardCheck },
    { href:"/employee/dashboard?view=history",label:"Learning history",icon:History }
  ];
  const active = (href: string) => { if (role === "hr" && pathname.startsWith("/hr/employees/")) return href === "/hr/dashboard"; const [path,query] = href.split("?"); return (pathname === path || role === "hr" && path === "/hr/dashboard" && pathname.startsWith("/hr/employees")) && (query ? view === new URLSearchParams(query).get("view") : view === "overview" || path !== "/employee/dashboard" && path !== "/hr/dashboard"); };
  const current = links.find(link => active(link.href));
  return <div className="min-h-screen lg:flex" onKeyDown={e => { if (e.key === "Escape" && open) close(); }}>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:p-3">{t("Skip to content")}</a>
    {open && <button className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" aria-label={t("Close navigation")} onClick={close}/>}
    <aside className={cn("workspace-sidebar", open ? "flex" : "hidden lg:flex")} onKeyDown={event => {
      if (!open || event.key !== "Tab") return;
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')).filter(item => item.offsetParent !== null);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <div className="flex items-center justify-between px-6 pb-8 pt-7"><Link href={links[0].href} className="flex items-center gap-3" onClick={()=>setOpen(false)}><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white"><Compass className="h-5 w-5"/></span><div className="text-base font-semibold tracking-tight text-white">CareerUp</div></Link><button ref={closeRef} onClick={close} className="p-2 text-white lg:hidden" aria-label={t("Close menu")}><X className="h-5 w-5"/></button></div>
      <p className="px-6 pb-3 text-[10px] font-medium uppercase tracking-[.16em] text-slate-400">{t(role === "hr" ? "People workspace" : "Your workspace")}</p>
      <nav aria-label={t("Main navigation")} className="flex-1 space-y-1 px-3">{links.map(({href,label,icon:Icon}) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} onClick={()=>setOpen(false)} className={cn("sidebar-link",active(href) && "sidebar-link-active")}><Icon className="h-[18px] w-[18px] shrink-0"/>{t(label)}</Link>)}</nav>
      <div className="mx-5 mb-5 mt-8 border-t border-white/10 pt-5"><p className="text-xs font-medium text-slate-200">{t("Synthetic demo ·")} {formatDate(date)}</p><p className="mt-2 text-xs leading-5 text-slate-400">{t("Development evidence, not a promotion decision.")}</p></div>
    </aside>
    <div className="min-w-0 flex-1"><header className="workspace-topbar"><div className="flex min-w-0 items-center gap-3"><Button ref={menuRef} variant="ghost" size="icon" className="lg:hidden" aria-label={t("Open navigation")} aria-expanded={open} onClick={()=>setOpen(true)}><Menu className="h-5 w-5"/></Button><span className="hidden text-xs text-muted-foreground sm:block">{t(role === "hr" ? "HR workspace" : "Employee workspace")}</span><span className="hidden text-slate-300 sm:block">/</span><span className="truncate text-sm font-medium">{t(current?.label ?? "Employee record")}</span></div><div className="flex shrink-0 items-center gap-3"><LanguageSwitcher/><div className="hidden border-l pl-4 md:block"><p className="text-xs font-semibold">{name}</p><p className="max-w-52 truncate text-[11px] text-muted-foreground">{position}</p></div><form action="/api/session" method="post"><input type="hidden" name="logout" value="true"/><Button variant="ghost" size="icon" aria-label={t("Switch account")} title={t("Switch account")}><LogOut className="h-4 w-4"/></Button></form></div></header><main id="main-content" className="workspace-main">{children}</main></div>
  </div>;
}
