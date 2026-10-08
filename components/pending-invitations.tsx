"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Loader2, RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type PendingInvite = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  smsDeliveryStatus: "PENDING" | "SENT" | "FAILED";
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  cancelledAt: string | null;
  lastSentAt: string | null;
  resendCount: number;
};

function label(invite: PendingInvite) {
  if (invite.status === "ACCEPTED") return "Accepted";
  if (invite.status === "CANCELLED") return "Cancelled";
  if (invite.status === "EXPIRED") return "Expired";
  if (invite.smsDeliveryStatus === "FAILED") return "Delivery failed";
  return "Pending delivery";
}

export function PendingInvitations() {
  const [items, setItems] = useState<PendingInvite[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  async function load() {
    const response = await fetch("/api/invitations", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setItems(data.invitations ?? []);
  }

  useEffect(() => {
    load().catch(() => undefined);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const visible = useMemo(() => items.filter((item) => item.status === "PENDING").slice(0, 5), [items]);

  async function action(id: string, kind: "cancel" | "resend") {
    setBusy(`${kind}:${id}`);
    try {
      const response = await fetch(`/api/invitations/${id}/${kind}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update invitation.");
      await load();
      toast.success(kind === "cancel" ? "Invitation cancelled" : "Invitation resent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update invitation.");
    } finally {
      setBusy(null);
    }
  }

  if (!visible.length) return <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground"><Clock3 className="size-4" />No pending invitations.</div>;

  return <div className="space-y-3">{visible.map((invite) => {
    const remaining = Math.max(0, new Date(invite.expiresAt).getTime() - now);
    const minutes = Math.floor(remaining / 60000);
    return <div key={invite.id} className="rounded-2xl border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-sm font-medium"><span className="inline-block size-2 rounded-full bg-primary" />{label(invite)}</div><p className="mt-1 text-xs text-muted-foreground">Expires in {remaining ? `${minutes}m` : "now"}</p></div>
        <div className="text-[11px] text-muted-foreground">Resends {invite.resendCount}/3</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy === `resend:${invite.id}`} onClick={() => action(invite.id, "resend")}>{busy === `resend:${invite.id}` ? <Loader2 className="animate-spin" /> : <RotateCw />} Resend</Button>
        <Button size="sm" variant="ghost" disabled={busy === `cancel:${invite.id}`} onClick={() => action(invite.id, "cancel")}>{busy === `cancel:${invite.id}` ? <Loader2 className="animate-spin" /> : <X />} Cancel</Button>
      </div>
    </div>;
  })}</div>;
}
