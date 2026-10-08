import Link from "next/link";
import { LockKeyhole } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) { return <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="Private Chat home"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><LockKeyhole className="size-4.5" /></span><span className={compact ? "font-semibold" : "text-base font-semibold tracking-tight"}>Private Chat</span></Link>; }
