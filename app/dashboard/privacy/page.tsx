import type { ComponentProps } from "react";
import { Database, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Privacy Center" };

const items = [
  { icon: PhoneIcon, title: "What is stored", body: "Your chat identity is an internal random user ID plus your chosen username. There is no phone-backed account. Phone numbers are stored only with invitations when needed for SMS delivery, encrypted at rest." },
  { icon: LockKeyhole, title: "What is not shared", body: "Phone numbers are excluded from chat APIs, WebSocket events, browser storage, analytics payloads, and chat metadata. Chat participants see usernames only." },
  { icon: KeyRound, title: "Sessions", body: "Authentication uses a server-side session with an HttpOnly, SameSite cookie. Only a keyed hash of the session secret is persisted. Authentication secrets are never stored in localStorage." },
  { icon: Database, title: "Messages", body: "The message store is prepared for server-side encrypted/private chat. This project does not claim end-to-end encryption until a reviewed E2EE protocol is actually implemented." },
];

function PhoneIcon(props: ComponentProps<"svg">) { return <ShieldCheck {...props} />; }

export default function PrivacyPage() {
  return <div className="mx-auto max-w-4xl px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-12"><div><p className="text-sm font-semibold text-primary">Privacy Center</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Understand the data boundary.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Phone numbers are private routing information, not public chat identity.</p></div><div className="mt-8 grid gap-4 md:grid-cols-2">{items.map((item) => { const Icon = item.icon; return <Card key={item.title}><CardHeader><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div><CardTitle className="pt-2 text-base">{item.title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{item.body}</p></CardContent></Card>; })}</div><Card className="mt-4 border-primary/20 bg-primary/[0.04]"><CardContent className="flex gap-3 p-5"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold">Phase 3 status</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Traditional account creation has been removed. Anonymous identity bootstrap, secure server sessions, encrypted invitation routing, single-use invite consumption, and privacy-safe invitation management are now real server-side flows. Realtime chat delivery is the next phase.</p></div></CardContent></Card></div>;
}
