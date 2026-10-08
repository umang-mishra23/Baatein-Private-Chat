import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PendingInvitations } from "@/components/pending-invitations";
import { ConversationList } from "@/components/conversation-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <div className="mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-12">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-medium text-primary">Private space</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Your private space.</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Manage conversations and send invitations without exposing phone numbers in chat.</p></div><Link href="/dashboard/new-chat"><Button size="lg"><Plus /> Start new chat</Button></Link></div>
    <div className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
      <Card className="overflow-hidden"><CardHeader className="border-b border-border"><div className="flex items-center justify-between"><div><CardTitle>Conversations</CardTitle><CardDescription>Your active private chats appear here.</CardDescription></div><Badge variant="outline">Private</Badge></div></CardHeader><CardContent className="p-0"><ConversationList /></CardContent></Card>
      <div className="space-y-4"><Card><CardHeader><CardTitle className="text-base">Pending invites</CardTitle><CardDescription>Links waiting to be accepted.</CardDescription></CardHeader><CardContent><PendingInvitations /></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Privacy snapshot</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-4 text-primary" /><div><p className="text-sm font-medium">Phone numbers stay out of chat</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Chat APIs expose usernames and conversation-safe identity fields only.</p></div></div><Link href="/dashboard/privacy" className="block text-sm font-semibold text-primary hover:underline">Open Privacy Center</Link></CardContent></Card></div>
    </div>
  </div>;
}
