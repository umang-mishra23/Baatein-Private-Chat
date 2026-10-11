import { notFound, redirect } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { getSessionUser } from "@/server/auth/session";
import { getConversationForUser } from "@/server/conversations/service";
import { ChatScreen } from "@/components/chat-screen";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser?.username) redirect("/start");
  const { conversationId } = await params;
  const user = { id: sessionUser.id, username: sessionUser.username };
  let conversation;
  try {
    conversation = await getConversationForUser(user.id, conversationId);
  } catch {
    notFound();
  }
  if (!conversation) notFound();
  const clientConversation = {
  ...conversation,
  createdAt: conversation.createdAt.toISOString(),
  updatedAt: conversation.updatedAt.toISOString(),
  };
  return <main className="flex min-h-[calc(100dvh-65px)] flex-col bg-background md:min-h-[calc(100dvh-73px)]">
    <div className="mx-auto w-full max-w-5xl flex-1 px-0 md:px-4 md:py-4">
      <div className="flex h-[calc(100dvh-65px)] flex-col overflow-hidden border-border bg-card md:h-[calc(100dvh-105px)] md:rounded-3xl md:border md:shadow-xl">
        <ChatScreen currentUser={{ id: user.id, username: user.username }} conversation={clientConversation} />
      </div>
    </div>
    <div className="sr-only"><LockKeyhole /> Private server-side encrypted chat. Phone numbers are not part of chat identity.</div>
  </main>;
}
