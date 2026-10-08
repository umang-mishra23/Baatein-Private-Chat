"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StartIdentity() {
  const [username, setUsername] = useState("");
  const [bootstrapping, setBootstrapping] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/session/bootstrap", { method: "POST", credentials: "include" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to start");
        if (mounted && data.user?.username) window.location.assign("/dashboard");
      })
      .catch(() => toast.error("Unable to start a private session. Please try again."))
      .finally(() => { if (mounted) setBootstrapping(false); });
    return () => { mounted = false; };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save");
      toast.success("Private identity ready");
      window.location.assign("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save your username.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Brand />
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Home</Link>
        </div>
        <section className="rounded-[2rem] border border-border bg-card p-6 shadow-xl sm:p-8">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole className="size-6" /></div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Start without an account</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">We create a private anonymous identity for this device. No password, email, or profile account is required.</p>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Choose your username</Label>
              <Input id="username" autoComplete="nickname" minLength={3} maxLength={32} placeholder="your-username" value={username} onChange={(event) => setUsername(event.target.value)} disabled={bootstrapping || saving} required />
              <p className="text-xs leading-5 text-muted-foreground">This is the identity other chat participants will see. Your phone number is not your identity.</p>
            </div>
            <Button className="w-full" size="lg" type="submit" disabled={bootstrapping || saving}>{saving ? "Securing session…" : "Continue privately"} <ArrowRight /></Button>
          </form>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-muted/40 p-4"><EyeOff className="size-4 text-primary" /><p className="mt-2 text-sm font-medium">No public phone identity</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Phone numbers are only used later for invitation delivery.</p></div>
            <div className="rounded-2xl border border-border bg-muted/40 p-4"><ShieldCheck className="size-4 text-primary" /><p className="mt-2 text-sm font-medium">Secure session</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Authentication stays in an HttpOnly server session cookie.</p></div>
          </div>
        </section>
      </div>
    </main>
  );
}
