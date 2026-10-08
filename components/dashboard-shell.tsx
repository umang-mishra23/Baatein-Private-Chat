"use client";

import Link from "next/link";
import { Home, LockKeyhole, LogOut, Menu, Plus, ShieldCheck, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { DashboardAvatar } from "@/components/dashboard-avatar";
import { Button } from "@/components/ui/button";

type Props = { user: { id: string; username: string } };
const nav = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/new-chat", label: "New chat", icon: Plus },
  { href: "/dashboard/privacy", label: "Privacy Center", icon: ShieldCheck },
];

export function DashboardShell({ children, user }: Props & { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      const response = await fetch("/api/session/logout", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error();
      router.replace("/");
      router.refresh();
    } catch {
      toast.error("Unable to end this session.");
    } finally {
      setLoggingOut(false);
    }
  }

  const navLinks = nav.map(({ href, label, icon: Icon }) => (
    <Link key={href} href={href} onClick={() => setOpen(false)} className={`rounded-xl px-3 py-2 text-sm font-medium transition ${path === href ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
      <span className="inline-flex items-center gap-2"><Icon className="size-4" />{label}</span>
    </Link>
  ));

  return (
    <div className="min-h-dvh bg-background">
      <header className="safe-top sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Brand />
          <div className="hidden items-center gap-2 md:flex">
            <nav className="flex items-center gap-1">{navLinks}</nav>
            <div className="ml-2 flex items-center gap-2 border-l border-border pl-3">
              <DashboardAvatar label={user.username} />
              <div className="hidden max-w-32 xl:block"><p className="truncate text-sm font-medium">@{user.username}</p><p className="text-[11px] text-muted-foreground">Private identity</p></div>
              <ThemeToggle />
              <Button variant="ghost" size="icon" aria-label="Log out" onClick={logout} disabled={loggingOut}><LogOut /></Button>
            </div>
          </div>
          <div className="flex items-center gap-1 md:hidden"><DashboardAvatar label={user.username} /><ThemeToggle /><Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></Button></div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="safe-top flex items-center justify-between border-b border-border px-4 py-3"><Brand /><Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setOpen(false)}><X /></Button></div>
          <div className="border-b border-border px-4 py-4"><div className="flex items-center gap-3"><DashboardAvatar label={user.username} /><div><p className="text-sm font-semibold">@{user.username}</p><p className="text-xs text-muted-foreground">Anonymous private identity</p></div></div></div>
          <nav className="grid gap-2 p-4">{navLinks}</nav>
          <div className="border-t border-border p-4"><Button variant="outline" className="w-full" onClick={logout} disabled={loggingOut}><LogOut /> {loggingOut ? "Ending session…" : "End this session"}</Button></div>
        </div>
      )}

      <div>{children}</div>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/92 px-2 py-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium ${path === href ? "bg-muted text-foreground" : "text-muted-foreground"}`}><Icon className="size-4" />{label}</Link>)}
        </div>
      </nav>
    </div>
  );
}
