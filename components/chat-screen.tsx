"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { io, Socket } from "socket.io-client";
import { ArrowLeft, Check, CheckCheck, Loader2, LockKeyhole, MoreVertical, Send, ShieldCheck, Smile } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001";

function timeLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function initials(username: string) { return username.slice(0, 2).toUpperCase(); }

export function ChatScreen({ currentUser, conversation }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const initializedScrollRef = useRef(false);

  const otherUserLabel = useMemo(() => `@${conversation.peer.username}`, [conversation.peer.username]);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
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
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
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
        if (!ack?.ok) {
          toast.error("This conversation is no longer available.");
          return;
        }
        setOnline(Boolean(ack.online));
      });
    });
    socket.on("disconnect", () => { setConnected(false); setOnline(false); setTyping(false); });
    socket.on("connect_error", () => setConnected(false));
    socket.on("message:new", (message: Message) => {
      if (message.conversationId !== conversation.id) return;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      if (message.senderId !== currentUser.id) {
        socket.emit("conversation:read", { conversationId: conversation.id, messageId: message.id });
      }
      scrollToBottom();
    });
    socket.on("message:delivery", (payload: { conversationId: string; messageIds: string[]; status: "DELIVERED" | "READ"; }) => {
      if (payload.conversationId !== conversation.id) return;
      setMessages((current) => current.map((item) => payload.messageIds.includes(item.id) ? { ...item, deliveryStatus: payload.status } : item));
    });
    socket.on("presence:update", (payload: { userId: string; online: boolean }) => {
      if (payload.userId === conversation.peer.id) setOnline(payload.online);
    });
    socket.on("typing:update", (payload: { userId: string; typing: boolean }) => {
      if (payload.userId === conversation.peer.id) setTyping(payload.typing);
    });
    socket.on("message:deleted", (payload: { conversationId: string; messageId: string }) => {
      if (payload.conversationId !== conversation.id) return;
      setMessages((current) => current.map((item) => item.id === payload.messageId ? { ...item, text: "Message deleted", deletedAt: new Date().toISOString(), deliveryStatus: item.deliveryStatus } : item));
    });
    return () => {
      socket.emit("conversation:leave", { conversationId: conversation.id });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [conversation.id, conversation.peer.id, currentUser.id]);

  useEffect(() => {
    const latestIncoming = [...messages].reverse().find((message) => message.senderId !== currentUser.id && !message.deletedAt);
    if (latestIncoming && document.visibilityState === "visible") {
      socketRef.current?.emit("conversation:read", { conversationId: conversation.id, messageId: latestIncoming.id });
    }
  }, [messages.length, conversation.id, currentUser.id]);

  async function sendViaRest(clientMessageId: string, value: string) {
    if (!value) return;
    const response = await fetch(`/api/conversations/${conversation.id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: value, clientMessageId }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to send message.");
    setMessages((current) => current.some((item) => item.id === data.message.id) ? current : [...current, data.message]);
    setText("");
    scrollToBottom();
  }

  function sendViaSocket(clientMessageId: string, value: string) {
    return new Promise<void>((resolve, reject) => {
      const socket = socketRef.current;
      if (!socket?.connected) return reject(new Error("Realtime unavailable"));
      let settled = false;
      const timer = window.setTimeout(() => {
        if (!settled) { settled = true; reject(new Error("Realtime acknowledgement timeout")); }
      }, 8000);
      socket.emit("message:send", { conversationId: conversation.id, text: value, clientMessageId }, (ack: { ok: boolean; message?: Message; error?: string }) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
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
    setTyping(false);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    socketRef.current?.emit("typing:stop", { conversationId: conversation.id });
    const clientMessageId = crypto.randomUUID();
    try {
      if (connected && socketRef.current?.connected) {
        try {
          await sendViaSocket(clientMessageId, value);
        } catch (error) {
          if (error instanceof Error && (error.message === "Realtime unavailable" || error.message === "Realtime acknowledgement timeout")) {
            await sendViaRest(clientMessageId, value);
          } else {
            throw error;
          }
        }
      } else {
        await sendViaRest(clientMessageId, value);
      }
      setText("");
      scrollToBottom();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send message.");
    } finally { setSending(false); }
  }

  function onTextChange(value: string) {
    setText(value);
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit("typing:start", { conversationId: conversation.id });
    setTyping(true);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      socket.emit("typing:stop", { conversationId: conversation.id });
      setTyping(false);
    }, 900);
  }

  function onListScroll() {
    const el = listRef.current;
    if (!el || loadingMore || !cursor) return;
    if (el.scrollTop < 120) void loadMessages(cursor);
  }

  return <div className="flex min-h-0 flex-1 flex-col">
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-xl sm:px-4">
      <Link href="/dashboard"><Button variant="ghost" size="icon" aria-label="Back to conversations"><ArrowLeft /></Button></Link>
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials(conversation.peer.username)}</div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{otherUserLabel}</p><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`size-1.5 rounded-full ${online ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />{typing ? "Typing…" : online ? "Online" : "Offline"}<span aria-hidden="true">·</span><span className="inline-flex items-center gap-1"><LockKeyhole className="size-3" /> Private</span></div></div>
      <Button variant="ghost" size="icon" aria-label="Conversation options"><MoreVertical /></Button>
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
              <div className={`max-w-[88%] sm:max-w-[72%] ${mine ? "items-end" : "items-start"}`}>
                <div className={`rounded-3xl px-4 py-2.5 text-sm leading-6 shadow-sm ${mine ? "rounded-br-lg bg-primary text-primary-foreground" : "rounded-bl-lg bg-muted text-foreground"}`}>
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                </div>
                <div className={`mt-1 flex items-center gap-1 px-1 text-[10px] text-muted-foreground ${mine ? "justify-end" : "justify-start"}`}><span>{timeLabel(message.createdAt)}</span>{mine && (message.deliveryStatus === "READ" ? <CheckCheck className="size-3 text-primary" /> : message.deliveryStatus === "DELIVERED" ? <CheckCheck className="size-3" /> : <Check className="size-3" />)}</div>
              </div>
            </div>
          </div>;
        })}
      </div>}
    </div>

    <div className="border-t border-border bg-background px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:px-6">
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1"><LockKeyhole className="size-3" /> Server-side encrypted · not end-to-end encrypted</span><span>{connected ? "Realtime" : "Offline mode"}</span></div>
      <form onSubmit={sendMessage} className="flex items-end gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Emoji" onClick={() => setText((value) => `${value} 🙂`)}><Smile /></Button>
        <Input value={text} onChange={(event) => onTextChange(event.target.value)} placeholder="Write a private message…" maxLength={4000} autoComplete="off" className="min-h-11 rounded-2xl" aria-label="Message" />
        <Button type="submit" size="icon" className="size-11 rounded-2xl" disabled={sending || !text.trim()} aria-label="Send message">{sending ? <Loader2 className="animate-spin" /> : <Send />}</Button>
      </form>
    </div>
  </div>;
}
