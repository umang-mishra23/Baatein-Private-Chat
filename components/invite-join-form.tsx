"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InviteJoinForm({ token, defaultExpiresAt }: { token: string; defaultExpiresAt?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [existingUsername, setExistingUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const current = data?.user?.username;
        if (current) {
          setExistingUsername(current);
          setUsername(current);
        }
      })
      .catch(() => undefined);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, username }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to accept this invitation.");
      toast.success(`Private chat ready with @${data.recipientUsername}`);
      router.replace(`/dashboard/chat/${encodeURIComponent(data.conversationId)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to accept this invitation.");
    } finally {
      setLoading(false);
    }
  }

  return <form className="space-y-5" onSubmit={submit}>
    <div className="space-y-2">
      <Label htmlFor="invite-username">Choose a username</Label>
      <Input id="invite-username" minLength={3} maxLength={32} autoComplete="username" placeholder="your-username" value={username} onChange={(e) => setUsername(e.target.value)} readOnly={Boolean(existingUsername)} required />
      <p className="text-xs leading-5 text-muted-foreground">{existingUsername ? `This browser already uses @${existingUsername}. We will keep that private identity.` : "This is the identity the other person will see."}</p>
    </div>
    {defaultExpiresAt && <p className="text-xs text-muted-foreground">Invitation expires {new Date(defaultExpiresAt).toLocaleString()}</p>}
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/50 p-4 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" /> Accepting creates a secure anonymous session. No account password or public phone identity is created.</div>
    <Button size="lg" className="w-full" type="submit" disabled={loading}>{loading ? <><Loader2 className="animate-spin" /> Joining…</> : <>Join private chat <ArrowRight /></>}</Button>
  </form>;
}
