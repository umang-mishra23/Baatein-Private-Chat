import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { NewChatForm } from "@/components/new-chat-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Start new chat" };

export default function NewChatPage() {
  return <div className="mx-auto max-w-3xl px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-12"><div className="mb-6"><Link href="/dashboard"><Button variant="ghost" size="sm" className="-ml-3"><ArrowLeft /> Dashboard</Button></Link></div><div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm sm:p-8"><div className="flex items-start gap-4"><div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole className="size-5" /></div><div><p className="text-sm font-semibold text-primary">New private chat</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Invite someone securely.</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Their phone number is used only for invitation delivery and remains private inside the conversation.</p></div></div><div className="mt-8"><NewChatForm /></div><div className="mt-7 flex items-start gap-3 rounded-2xl border border-border bg-muted/50 p-4 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />The SMS invitation service is now live behind the server API. Phone numbers remain routing data only; chat identity uses your username.</div></div></div>;
}
