"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, EyeOff, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SafeInvite = { id: string; expiresAt: string; status: string };

export function NewChatForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [username, setUsername] = useState("your-username");
  const [invite, setInvite] = useState<SafeInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => data?.user?.username && setUsername(data.user.username))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!invite) return;
    const tick = () => setRemaining(Math.max(0, new Date(invite.expiresAt).getTime() - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [invite]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const form = formRef.current;
      if (!form) throw new Error("Unable to submit invitation.");
      const values = new FormData(form);
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipientPhone: values.get("recipientPhone"),
          firstMessage: values.get("firstMessage") || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send invitation.");
      setInvite(data);
      formRef.current?.reset();
      toast.success("Private invitation sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send invitation.");
    } finally {
      setLoading(false);
    }
  }

  function formatRemaining(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }

  if (invite) {
    return (
      <div className="space-y-5 rounded-3xl border border-primary/25 bg-primary/5 p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><CheckCircle2 className="size-5" /></div>
          <div>
            <h2 className="font-semibold">Private invitation sent</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">The recipient received a generic secure link. Their phone number is not shown back to you.</p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-4"><span className="text-muted-foreground">Invitation expires in</span><span className="font-semibold tabular-nums">{remaining ? formatRemaining(remaining) : "Expired"}</span></div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Opening or forwarding this link does not reveal either phone number. The link is single-use.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/dashboard" className="sm:flex-1"><Button className="w-full" variant="outline">Back to dashboard</Button></Link>
          <Button className="sm:flex-1" onClick={() => { setInvite(null); formRef.current?.reset(); }}><Send /> Send another</Button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} className="space-y-6" onSubmit={submit}>
      <div className="space-y-2">
        <Label htmlFor="recipient-phone">Recipient phone number</Label>
        <Input id="recipient-phone" name="recipientPhone" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" required />
        <p className="text-xs leading-5 text-muted-foreground">Used only for secure SMS delivery. The number is encrypted at rest and never appears in chat APIs.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="first-message">Optional first message</Label>
        <Textarea id="first-message" name="firstMessage" placeholder="Hey, I wanted to talk privately…" maxLength={1000} />
        <p className="text-right text-xs text-muted-foreground">Optional · up to 1000 characters</p>
      </div>
      <div className="rounded-2xl border border-border bg-muted/50 p-4 text-sm">
        <div className="font-medium">Sender identity preview</div>
        <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-background px-3 py-2 font-medium">@{username}</div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Only your username is shown in the eventual chat.</p>
      </div>
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/50 p-4 text-xs leading-5 text-muted-foreground"><EyeOff className="mt-0.5 size-4 shrink-0 text-primary" /> Your raw phone number is used only for this delivery request and is never returned by the invitation API.</div>
      <Button size="lg" className="w-full" type="submit" disabled={loading}>{loading ? <><Loader2 className="animate-spin" /> Sending secure invite…</> : <>Send private invite <ArrowRight /></>}</Button>
      {loading && <p className="sr-only" aria-live="polite">Sending invitation</p>}
    </form>
  );
}
