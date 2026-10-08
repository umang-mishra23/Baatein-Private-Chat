import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, MessageCircle, ShieldCheck, Smartphone } from "lucide-react";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const steps = [
  { title: "Send a private invite", description: "Enter a phone number only for delivery. It never becomes a chat identity.", icon: Smartphone },
  { title: "They choose a username", description: "The recipient joins from a single-use secure link and picks the identity they want to use.", icon: MessageCircle },
  { title: "Chat without phone numbers", description: "Both sides see usernames and conversation state — never each other's phone number.", icon: LockKeyhole },
];

const privacyPoints = [
  "No password, email, or traditional account is required.",
  "Phone numbers are private routing information, not chat identity.",
  "Sessions are server-side and stored only as hashed credentials.",
  "Invitation links are single-use and expire automatically.",
];

export default function Home() {
  return (
    <main className="min-h-dvh overflow-x-hidden">
      <header className="safe-top sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Brand />
          <div className="flex items-center gap-2"><ThemeToggle /><Link href="/start"><Button size="sm">Start privately</Button></Link></div>
        </div>
      </header>

      <section className="relative">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pb-28 lg:pt-28">
          <div className="flex flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm"><ShieldCheck className="size-3.5 text-primary" /> Privacy-first messaging</div>
            <h1 className="max-w-3xl text-balance text-5xl font-semibold tracking-[-0.045em] sm:text-6xl lg:text-7xl">Private conversations without exposing your phone number.</h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl">Start instantly with a private anonymous identity. Send a secure SMS invitation, then chat through usernames instead of phone numbers.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/start"><Button size="lg" className="group">Start a Private Chat <ArrowRight className="transition-transform group-hover:translate-x-0.5" /></Button></Link><a href="#how-it-works"><Button size="lg" variant="outline">See how it works</Button></a></div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span>✓ No account</span><span>✓ Single-use invites</span><span>✓ No phone numbers in chat</span></div>
          </div>

          <div className="relative mx-auto w-full max-w-[430px] lg:max-w-none">
            <div className="absolute -inset-12 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
            <div className="relative rounded-[2rem] border border-border/80 bg-card/90 p-3 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-4">
              <div className="rounded-[1.5rem] border border-border bg-background p-3 sm:p-4">
                <div className="flex items-center justify-between border-b border-border pb-3"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><LockKeyhole className="size-4" /></div><div><p className="text-sm font-semibold">Private session</p><p className="text-xs text-muted-foreground">phone numbers hidden</p></div></div><div className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">SECURE</div></div>
                <div className="space-y-3 py-5"><div className="ml-auto max-w-[78%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">Hey, I wanted to talk privately.</div><div className="max-w-[78%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm">Sure. Nice to meet you here. 👋</div><div className="ml-auto max-w-[72%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground">Only our usernames are visible.</div></div>
                <div className="rounded-2xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">Your chat identity is a username, not a phone number.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border/70 bg-muted/30"><div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-semibold text-primary">How it works</p><h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Private from the first screen.</h2></div><div className="mt-10 grid gap-4 md:grid-cols-3">{steps.map(({ title, description, icon: Icon }, index) => <article key={title} className="rounded-[1.75rem] border border-border bg-card p-6"><div className="flex items-center justify-between"><div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-5" /></div><span className="text-xs font-semibold text-muted-foreground">0{index + 1}</span></div><h3 className="mt-6 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></article>)}</div></div></section>

      <section><div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24"><div><p className="text-sm font-semibold text-primary">Privacy by design</p><h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Your phone number is routing data. Nothing more.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">The product keeps the delivery channel separate from the identity used in chat. This allows a recipient to join from a secure link without learning the sender's number — and vice versa.</p></div><div className="rounded-[2rem] border border-border bg-card p-6 sm:p-8">{privacyPoints.map((point) => <div key={point} className="flex items-start gap-3 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0"><div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Check className="size-3.5" /></div><p className="text-sm leading-6">{point}</p></div>)}</div></div></section>

      <footer className="border-t border-border"><div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><Brand /><div>Private messaging without turning phone numbers into identities.</div></div></footer>
    </main>
  );
}
