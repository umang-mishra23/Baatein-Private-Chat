"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Conversation = { id: string; updatedAt: string; peer: { id: string; username: string }; lastMessage: { text: string; createdAt: string; senderId: string } | null };

function relativeDate(value: string) {
  const then = new Date(value).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

export function ConversationList() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/conversations", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then((data) => setItems(data.conversations ?? [])).catch(() => undefined).finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="space-y-3 p-4">{[0,1,2].map((n) => <div key={n} className="h-16 animate-pulse rounded-2xl bg-muted" />)}</div>;
  if (!items.length) return <div className="flex flex-col items-center justify-center px-6 py-16 text-center"><div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><MessageCircle className="size-6" /></div><h2 className="mt-5 text-lg font-semibold">No conversations yet</h2><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Start a private chat by sending an invitation. The recipient will choose their username after opening it.</p><Link href="/dashboard/new-chat" className="mt-5"><Button>Send a private invite <ArrowRight /></Button></Link></div>;
  return <div className="divide-y divide-border">{items.map((conversation) => <Link key={conversation.id} href={`/dashboard/chat/${conversation.id}`} className="flex min-w-0 gap-3 px-4 py-4 transition hover:bg-muted/40"><div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">{conversation.peer.username.slice(0,2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate font-medium">@{conversation.peer.username}</p>{conversation.lastMessage && <span className="shrink-0 text-[11px] text-muted-foreground">{relativeDate(conversation.lastMessage.createdAt)}</span>}</div><p className="mt-1 truncate text-sm text-muted-foreground">{conversation.lastMessage?.text ?? "Start your private conversation"}</p></div></Link>)}</div>;
}
