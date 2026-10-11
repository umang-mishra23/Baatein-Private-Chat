"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Database, KeyRound, LockKeyhole, ShieldCheck, Trash2, UserRoundX, UserX, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type BlockedUser = { id: string; username: string; createdAt: string };
type Session = { isCurrent: boolean; createdAt: string; expiresAt: string; lastSeenAt: string };

const items = [
  { icon: ShieldCheck, title: "What is stored", body: "Your chat identity is an internal random user ID plus your chosen username. Phone numbers are private routing information and are not displayed in chat." },
  { icon: LockKeyhole, title: "What is not shared", body: "Phone numbers and invitation tokens are excluded from chat APIs and WebSocket events. Other participants see usernames, not phone identities." },
  { icon: KeyRound, title: "Sessions", body: "Authentication uses a server-side session and an HttpOnly cookie. You can revoke other active sessions below." },
  { icon: Database, title: "Messages", body: "Messages are encrypted at rest by the server. This product is not end-to-end encrypted; the server can decrypt messages for delivery." },
];

export function PrivacyCenter() {
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [blockedResponse, sessionsResponse] = await Promise.all([
        fetch("/api/privacy/blocked", { cache: "no-store" }),
        fetch("/api/privacy/sessions", { cache: "no-store" }),
      ]);
      if (!blockedResponse.ok || !sessionsResponse.ok) throw new Error();
      const [blockedData, sessionsData] = await Promise.all([blockedResponse.json(), sessionsResponse.json()]);
      setBlocked(blockedData.blockedUsers ?? []);
      setSessions(sessionsData.sessions ?? []);
    } catch {
      toast.error("Unable to load all privacy settings.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function unblock(user: BlockedUser) {
    setBusyId(user.id);
    try {
      const response = await fetch(`/api/privacy/blocked/${user.id}`, { method: "DELETE", headers: { "content-type": "application/json" } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to unblock user.");
      setBlocked((current) => current.filter((item) => item.id !== user.id));
      toast.success(`Unblocked @${user.username}.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to unblock user."); }
    finally { setBusyId(null); }
  }

  async function revokeOthers() {
    if (!window.confirm("Revoke all other active sessions? This browser will remain signed in.")) return;
    setRevoking(true);
    try {
      const response = await fetch("/api/privacy/sessions", { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to revoke sessions.");
      toast.success(`Revoked ${data.revoked} other session(s).`);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to revoke sessions."); }
    finally { setRevoking(false); }
  }

  async function deleteIdentity() {
    if (deleteText !== "DELETE") return;
    setDeleting(true);
    try {
      const response = await fetch("/api/me", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete identity.");
      window.location.assign("/");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to delete identity."); }
    finally { setDeleting(false); }
  }

  return <div className="mx-auto max-w-4xl px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-12">
    <div><p className="text-sm font-semibold text-primary">Privacy Center</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Your privacy, under your control.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Phone numbers are private routing information, not public chat identity.</p></div>
    <div className="mt-8 grid gap-4 md:grid-cols-2">{items.map((item) => { const Icon = item.icon; return <Card key={item.title}><CardHeader><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div><CardTitle className="pt-2 text-base">{item.title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{item.body}</p></CardContent></Card>; })}</div>

    <Card className="mt-5"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserX className="size-5" /> Blocked users</CardTitle><p className="text-sm text-muted-foreground">Blocked users cannot send messages to you. Unblocking restores access to any conversation hidden when you blocked them.</p></CardHeader><CardContent>
      {loading ? <div className="h-12 animate-pulse rounded-xl bg-muted" /> : blocked.length === 0 ? <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">You haven't blocked anyone.</p> : <div className="divide-y divide-border">{blocked.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">@{item.username}</p><p className="text-xs text-muted-foreground">Blocked {new Date(item.createdAt).toLocaleDateString()}</p></div><Button variant="outline" size="sm" disabled={busyId === item.id} onClick={() => void unblock(item)}>{busyId === item.id ? "Working…" : "Unblock"}</Button></div>)}</div>}
    </CardContent></Card>

    <Card className="mt-5"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-5" /> Active sessions</CardTitle><p className="text-sm text-muted-foreground">The session cookie is never displayed. You can revoke other sessions while keeping this browser signed in.</p></CardHeader><CardContent>
      {loading ? <div className="h-12 animate-pulse rounded-xl bg-muted" /> : <><div className="space-y-2">{sessions.map((session, index) => <div key={`${session.createdAt}-${index}`} className="flex items-start gap-3 rounded-xl border border-border p-3"><div className="grid size-9 place-items-center rounded-lg bg-muted"><LockKeyhole className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium">{session.isCurrent ? "This browser" : "Other session"} {session.isCurrent && <span className="text-primary">· Current</span>}</p><p className="mt-1 text-xs text-muted-foreground">Last active {new Date(session.lastSeenAt).toLocaleString()}</p><p className="text-xs text-muted-foreground">Expires {new Date(session.expiresAt).toLocaleDateString()}</p></div></div>)}</div><Button className="mt-4" variant="outline" onClick={() => void revokeOthers()} disabled={revoking || sessions.filter((session) => !session.isCurrent).length === 0}><RefreshCw className="size-4" />{revoking ? "Revoking…" : "Revoke other sessions"}</Button></>}
    </CardContent></Card>

    <Card className="mt-5 border-destructive/30"><CardHeader><CardTitle className="flex items-center gap-2 text-base text-destructive"><UserRoundX className="size-5" /> Delete anonymous identity</CardTitle><p className="text-sm text-muted-foreground">This is permanent. It revokes sessions, removes your profile details, cancels invitations, and deletes conversations and their message history for both participants. Safety reports may be retained in anonymized form.</p></CardHeader><CardContent>
      {!deleteOpen ? <Button variant="destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="size-4" /> Delete identity and chat data</Button> : <div className="space-y-3 rounded-xl border border-destructive/30 p-4"><div className="flex gap-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive"/><p>This cannot be undone. Type <strong>DELETE</strong> to confirm.</p></div><Input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} placeholder="Type DELETE" aria-label="Type DELETE to confirm identity deletion" autoComplete="off"/><div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={deleteText !== "DELETE" || deleting} onClick={() => void deleteIdentity()}>{deleting ? "Deleting…" : "Confirm permanent deletion"}</Button><Button variant="outline" disabled={deleting} onClick={() => { setDeleteOpen(false); setDeleteText(""); }}>Cancel</Button></div></div>}
    </CardContent></Card>

    <p className="mt-5 text-xs leading-5 text-muted-foreground">Privacy note: server-side encryption is not end-to-end encryption. The server processes message plaintext to deliver chat messages.</p>
  </div>;
}
