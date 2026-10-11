"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { AlertTriangle, ArrowLeft, Check, CheckCheck, Flag, Loader2, LockKeyhole, MoreVertical, Send, ShieldBan, ShieldCheck, Smile, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  senderUsername: string;
  text: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  deliveryStatus: "SENT" | "DELIVERED" | "READ" | null;
};

type Conversation = {
  id: string;
  createdAt: string;
  updatedAt: string;
  peer: { id: string; username: string };
};

type Props = { currentUser: { id: string; username: string }; conversation: Conversation };
type DialogType = "block" | "report" | "delete-conversation" | null;

const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001";

function timeLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}
function initials(username: string) { return username.slice(0, 2).toUpperCase(); }

export function ChatScreen({ currentUser, conversation }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogType>(null);
  const [reportReason, setReportReason] = useState("HARASSMENT");
  const [reportDetails, setReportDetails] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const initializedScrollRef = useRef(false);
  const otherUserLabel = useMemo(() => `@${conversation.peer.username}`, [conversation.peer.username]);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior });
    });
  }

  async function loadMessages(nextCursor?: string | null) {
    if (nextCursor === undefined) setLoading(true); else setLoadingMore(true);
    try {
      const query = nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : "";
      const response = await fetch(`/api/conversations/${conversation.id}/messages${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json() as { messages: Message[]; nextCursor: string | null };
      setMessages((current) => nextCursor ? [...data.messages, ...current] : data.messages);
      setCursor(data.nextCursor);
    } catch {
      toast.error("Unable to load messages.");
    } finally { setLoading(false); setLoadingMore(false); }
  }

  useEffect(() => { void loadMessages(); }, [conversation.id]);

  useEffect(() => {
    if (!initializedScrollRef.current && messages.length) {
      initializedScrollRef.current = true;
      scrollToBottom("auto");
    }
  }, [messages.length]);

  useEffect(() => {
    const socket = io(realtimeUrl, { withCredentials: true, transports: ["websocket", "polling"], autoConnect: true });
    socketRef.current = socket;
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("conversation:join", { conversationId: conversation.id }, (ack: { ok: boolean; error?: string; online?: boolean }) => {
        if (!ack?.ok) { toast.error("This conversation is no longer available."); return; }
        setOnline(Boolean(ack.online));
      });
    });
    socket.on("disconnect", () => { setConnected(false); setOnline(false); setTyping(false); });
    socket.on("connect_error", () => setConnected(false));
    socket.on("message:new", (message: Message) => {
      if (message.conversationId !== conversation.id) return;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      if (message.senderId !== currentUser.id) socket.emit("conversation:read", { conversationId: conversation.id, messageId: message.id });
      scrollToBottom();
    });
    socket.on("message:delivery", (payload: { conversationId: string; messageIds: string[]; status: "DELIVERED" | "READ" }) => {
      if (payload.conversationId !== conversation.id) return;
      setMessages((current) => current.map((item) => payload.messageIds.includes(item.id) ? { ...item, deliveryStatus: payload.status } : item));
    });
    socket.on("presence:update", (payload: { userId: string; online: boolean }) => { if (payload.userId === conversation.peer.id) setOnline(payload.online); });
    socket.on("typing:update", (payload: { userId: string; typing: boolean }) => { if (payload.userId === conversation.peer.id) setTyping(payload.typing); });
    socket.on("message:deleted", (payload: { conversationId: string; messageId: string }) => {
      if (payload.conversationId !== conversation.id) return;
      setMessages((current) => current.map((item) => item.id === payload.messageId ? { ...item, text: "Message deleted", deletedAt: new Date().toISOString() } : item));
    });
    return () => {
      socket.emit("conversation:leave", { conversationId: conversation.id });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [conversation.id, conversation.peer.id, currentUser.id]);

  useEffect(() => {
    const latestIncoming = [...messages].reverse().find((message) => message.senderId !== currentUser.id && !message.deletedAt);
    if (latestIncoming && document.visibilityState === "visible") socketRef.current?.emit("conversation:read", { conversationId: conversation.id, messageId: latestIncoming.id });
  }, [messages.length, conversation.id, currentUser.id]);

  async function sendViaRest(clientMessageId: string, value: string) {
    if (!value) return;
    const response = await fetch(`/api/conversations/${conversation.id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: value, clientMessageId }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to send message.");
    setMessages((current) => current.some((item) => item.id === data.message.id) ? current : [...current, data.message]);
    setText(""); scrollToBottom();
  }

  function sendViaSocket(clientMessageId: string, value: string) {
    return new Promise<void>((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket?.connected) return reject(new Error("Realtime unavailable"));
      let settled = false;
      const timer = window.setTimeout(() => { if (!settled) { settled = true; reject(new Error("Realtime acknowledgement timeout")); } }, 8000);
      socket.emit("message:send", { conversationId: conversation.id, text: value, clientMessageId }, (ack: { ok: boolean; message?: Message; error?: string }) => {
        if (settled) return;
        settled = true; window.clearTimeout(timer);
        if (!ack?.ok || !ack.message) return reject(new Error(ack?.error || "Unable to send message."));
        setMessages((current) => current.some((item) => item.id === ack.message!.id) ? current : [...current, ack.message!]);
        resolve();
      });
    });
  }

  async function sendMessage(event?: React.FormEvent) {
    event?.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    socketRef.current?.emit("typing:stop", { conversationId: conversation.id });
    const clientMessageId = crypto.randomUUID();
    try {
      if (connected && socketRef.current?.connected) {
        try { await sendViaSocket(clientMessageId, value); }
        catch (error) {
          if (error instanceof Error && (error.message === "Realtime unavailable" || error.message === "Realtime acknowledgement timeout")) await sendViaRest(clientMessageId, value);
          else throw error;
        }
      } else await sendViaRest(clientMessageId, value);
      setText(""); scrollToBottom();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to send message."); }
    finally { setSending(false); }
  }

  function onTextChange(value: string) {
    setText(value);
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit("typing:start", { conversationId: conversation.id });
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => socket.emit("typing:stop", { conversationId: conversation.id }), 900);
  }

  function onListScroll() {
    const el = listRef.current;
    if (!el || loadingMore || !cursor) return;
    if (el.scrollTop < 120) void loadMessages(cursor);
  }

  async function performBlock() {
    setActionBusy(true);
    try {
      const response = await fetch(`/api/conversations/${conversation.id}/block`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to block this user.");
      socketRef.current?.emit("conversation:leave", { conversationId: conversation.id });
      toast.success(`@${conversation.peer.username} was blocked.`);
      router.replace("/dashboard/privacy"); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to block this user."); }
    finally { setActionBusy(false); setDialog(null); setMenuOpen(false); }
  }

  async function performReport() {
    setActionBusy(true);
    try {
      const response = await fetch(`/api/conversations/${conversation.id}/report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: reportReason, details: reportDetails.trim() || undefined }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit report.");
      toast.success("Report submitted. Thank you for helping keep the community safe.");
      setReportDetails(""); setDialog(null); setMenuOpen(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to submit report."); }
    finally { setActionBusy(false); }
  }

  async function performDeleteConversation() {
    setActionBusy(true);
    try {
      const response = await fetch(`/api/conversations/${conversation.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete conversation.");
      socketRef.current?.emit("conversation:leave", { conversationId: conversation.id });
      toast.success("Conversation removed from your private space.");
      router.replace("/dashboard"); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to delete conversation."); }
    finally { setActionBusy(false); setDialog(null); setMenuOpen(false); }
  }

  function deleteMessage(message: Message) {
    if (!socketRef.current?.connected) { toast.error("Connect to realtime chat before deleting a message."); return; }
    if (!window.confirm("Delete this message for both participants? This cannot be undone.")) return;
    socketRef.current.emit("message:delete", { conversationId: conversation.id, messageId: message.id }, (ack: { ok: boolean; error?: string }) => {
      if (!ack?.ok) toast.error(ack?.error || "Unable to delete message.");
    });
  }

  return <div className="flex min-h-0 flex-1 flex-col">
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl sm:px-4">
      <Link href="/dashboard"><Button variant="ghost" size="icon" aria-label="Back to conversations"><ArrowLeft /></Button></Link>
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials(conversation.peer.username)}</div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{otherUserLabel}</p><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`size-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />{typing ? "Typing…" : online ? "Online" : "Offline"}<span aria-hidden="true">·</span><span className="inline-flex items-center gap-1"><LockKeyhole className="size-3" /> Private</span></div></div>
      <div className="relative">
        <Button variant="ghost" size="icon" aria-label="Conversation options" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><MoreVertical /></Button>
        {menuOpen && <div className="absolute right-0 top-12 z-40 w-56 rounded-2xl border border-border bg-card p-1.5 shadow-xl">
          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted" onClick={() => { setMenuOpen(false); setDialog("block"); }}><ShieldBan className="size-4" /> Block @{conversation.peer.username}</button>
          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted" onClick={() => { setMenuOpen(false); setDialog("report"); }}><Flag className="size-4" /> Report user</button>
          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10" onClick={() => { setMenuOpen(false); setDialog("delete-conversation"); }}><Trash2 className="size-4" /> Delete conversation</button>
        </div>}
      </div>
    </header>

    <div ref={listRef} onScroll={onListScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
      {cursor && <div className="mb-4 flex justify-center"><Button variant="outline" size="sm" onClick={() => void loadMessages(cursor)} disabled={loadingMore}>{loadingMore ? <Loader2 className="animate-spin" /> : "Load older messages"}</Button></div>}
      {loading ? <div className="space-y-3 py-6">{[0,1,2,3].map((n) => <div key={n} className={`h-12 max-w-[78%] animate-pulse rounded-2xl bg-muted ${n % 2 ? "ml-auto" : ""}`} />)}</div> : messages.length === 0 ? <div className="grid h-full place-items-center py-16 text-center"><div><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="size-6" /></div><h2 className="mt-4 text-lg font-semibold">Private conversation</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Messages are stored encrypted on the server. Phone numbers are not part of this chat.</p></div></div> : <div className="space-y-2">
        {messages.map((message, index) => {
          const mine = message.senderId === currentUser.id;
          const previous = messages[index - 1];
          const showDate = !previous || dateLabel(previous.createdAt) !== dateLabel(message.createdAt);
          return <div key={message.id}>
            {showDate && <div className="my-5 text-center text-[11px] font-medium text-muted-foreground">{dateLabel(message.createdAt)}</div>}
            <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] ${mine ? "sm:max-w-[72%]" : "sm:max-w-[72%]"}`}>
                <div className={`rounded-3xl px-4 py-2.5 text-sm leading-6 shadow-sm ${mine ? "rounded-br-lg bg-primary text-primary-foreground" : "rounded-bl-lg bg-muted text-foreground"}`}><p className="whitespace-pre-wrap break-words">{message.text}</p></div>
                <div className={`mt-1 flex items-center gap-2 px-1 text-[10px] text-muted-foreground ${mine ? "justify-end" : "justify-start"}`}>
                  <span>{timeLabel(message.createdAt)}</span>
                  {mine && (message.deliveryStatus === "READ" ? <CheckCheck className="size-3 text-primary" /> : message.deliveryStatus === "DELIVERED" ? <CheckCheck className="size-3" /> : <Check className="size-3" />)}
                  {mine && !message.deletedAt && <button type="button" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Delete message" title="Delete message" onClick={() => deleteMessage(message)}><Trash2 className="size-3" /></button>}
                </div>
              </div>
            </div>
          </div>;
        })}
      </div>}
    </div>

    <div className="border-t border-border bg-background px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:px-6">
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1"><LockKeyhole className="size-3" /> Server-side encrypted · not end-to-end encrypted</span><span>{connected ? "Realtime" : "Offline mode"}</span></div>
      <form onSubmit={sendMessage} className="flex items-end gap-2"><Button type="button" variant="ghost" size="icon" aria-label="Emoji" onClick={() => setText((value) => `${value} 🙂`)}><Smile /></Button><Input value={text} onChange={(event) => onTextChange(event.target.value)} placeholder="Write a private message…" maxLength={4000} autoComplete="off" className="min-h-11 rounded-2xl" aria-label="Message" /><Button type="submit" size="icon" className="size-11 rounded-2xl" disabled={sending || !text.trim()} aria-label="Send message">{sending ? <Loader2 className="animate-spin" /> : <Send />}</Button></form>
    </div>

    {dialog && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !actionBusy) setDialog(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="privacy-action-title" className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{dialog === "block" ? <ShieldBan className="size-5" /> : dialog === "report" ? <Flag className="size-5" /> : <Trash2 className="size-5" />}</div><div><h2 id="privacy-action-title" className="text-lg font-semibold">{dialog === "block" ? "Block this user?" : dialog === "report" ? "Report this user" : "Delete this conversation?"}</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{dialog === "block" ? `You and @${conversation.peer.username} will not be able to exchange messages until you unblock them.` : dialog === "report" ? "Reports are reviewed for safety. Do not include phone numbers or other sensitive personal information." : "This removes the conversation from your private space. It does not delete the other participant's history."}</p></div></div><Button size="icon" variant="ghost" aria-label="Close dialog" disabled={actionBusy} onClick={() => setDialog(null)}><X className="size-4" /></Button></div>
        {dialog === "report" && <div className="mt-5 space-y-3"><label className="block text-sm font-medium" htmlFor="report-reason">Reason</label><select id="report-reason" value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="SPAM">Spam</option><option value="HARASSMENT">Harassment</option><option value="THREATS">Threats or violence</option><option value="IMPERSONATION">Impersonation</option><option value="OTHER">Other</option></select><label className="block text-sm font-medium" htmlFor="report-details">Additional details (optional)</label><Textarea id="report-details" value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={2000} placeholder="Describe the concern without sharing sensitive personal details." className="min-h-24" /></div>}
        {dialog === "block" && <div className="mt-4 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground"><AlertTriangle className="mr-2 inline size-4" />Their access to this conversation will be restricted until you unblock them.</div>}
        <div className="mt-6 flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={actionBusy} onClick={() => setDialog(null)}>Cancel</Button>{dialog === "block" ? <Button variant="destructive" disabled={actionBusy} onClick={() => void performBlock()}>{actionBusy ? "Blocking…" : "Block user"}</Button> : dialog === "report" ? <Button disabled={actionBusy} onClick={() => void performReport()}>{actionBusy ? "Submitting…" : "Submit report"}</Button> : <Button variant="destructive" disabled={actionBusy} onClick={() => void performDeleteConversation()}>{actionBusy ? "Deleting…" : "Delete conversation"}</Button>}</div>
      </div>
    </div>}
  </div>;
}
