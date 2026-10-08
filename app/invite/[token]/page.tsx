import { Clock3, FileWarning, LockKeyhole, ShieldCheck, XCircle } from "lucide-react";
import { InviteJoinForm } from "@/components/invite-join-form";
import { getInvitationPreview } from "@/server/invitations/service";

export const dynamic = "force-dynamic";

function StatusPage({ kind, title, copy }: { kind: "expired" | "used" | "invalid"; title: string; copy: string }) {
  const Icon = kind === "expired" ? Clock3 : kind === "used" ? XCircle : FileWarning;
  return <main className="grid min-h-dvh place-items-center px-4 py-10"><div className="w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-xl sm:p-8"><div className="grid size-13 place-items-center rounded-2xl bg-muted text-muted-foreground"><Icon className="size-6" /></div><p className="mt-6 text-sm font-semibold text-primary">Private invitation</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">{copy}</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><a href="/start" className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">Return to home</a><a href="/start" className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium">Request a new invitation</a></div></div></main>;
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await getInvitationPreview(token);

  if (preview.state === "expired") return <StatusPage kind="expired" title="Invitation expired" copy="This secure invitation was not used before its expiry time. Ask the sender to send a new invitation." />;
  if (preview.state === "used") return <StatusPage kind="used" title="Invitation already used" copy="This single-use invitation has already been accepted. Ask the sender for a new private invitation if needed." />;
  if (preview.state === "cancelled" || preview.state === "invalid") return <StatusPage kind="invalid" title="Invitation unavailable" copy="This invitation link is invalid, cancelled, or no longer available. Ask the sender for a new secure link." />;

  return <main className="grid min-h-dvh place-items-center px-4 py-10"><div className="w-full max-w-md rounded-[2rem] border border-border bg-card p-6 shadow-xl sm:p-8"><div className="grid size-13 place-items-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole className="size-6" /></div><p className="mt-6 text-sm font-semibold text-primary">Private invitation</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Someone wants to start a private conversation with you.</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">Your phone number stays private, and the other person&apos;s phone number stays private. Choose a username to continue.</p><div className="mt-6 space-y-3"><div className="flex gap-3 rounded-2xl border border-border bg-muted/50 p-4 text-sm"><ShieldCheck className="size-4 shrink-0 text-primary" /> Chat identity uses a username, not a phone number.</div><div className="flex gap-3 rounded-2xl border border-border bg-muted/50 p-4 text-sm"><Clock3 className="size-4 shrink-0 text-primary" /> This invitation is single-use and will expire automatically.</div></div><div className="mt-7"><InviteJoinForm token={token} defaultExpiresAt={preview.expiresAt.toISOString()} /></div></div></main>;
}
