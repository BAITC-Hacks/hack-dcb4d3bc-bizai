import { requireActor } from "@/lib/server/session";
import { AppShell } from "@/components/shell/app-shell";
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireActor("hr");
  return <AppShell role="hr">{children}</AppShell>;
}
