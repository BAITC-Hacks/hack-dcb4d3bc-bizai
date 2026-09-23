import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Career Quest · BizAI", description: "Employee development, skills and career trajectories" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
