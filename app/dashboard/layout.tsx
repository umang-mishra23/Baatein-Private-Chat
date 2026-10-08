import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/start");
  if (!user.username) redirect("/start");
  return <DashboardShell user={{ id: user.id, username: user.username }}>{children}</DashboardShell>;
}
