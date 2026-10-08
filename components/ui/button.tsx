import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "default" | "lg" | "icon";
export function Button({ className, variant = "default", size = "default", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) { const v = { default: "bg-primary text-primary-foreground shadow-sm hover:opacity-95", secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80", outline: "border border-border bg-background hover:bg-muted", ghost: "hover:bg-muted", destructive: "bg-red-600 text-white hover:bg-red-700" }[variant]; const s = { sm: "h-9 rounded-xl px-3 text-sm", default: "h-10 rounded-xl px-4 text-sm", lg: "h-12 rounded-2xl px-5 text-sm", icon: "size-10 rounded-xl p-0" }[size]; return <button className={cn("inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-ring", v, s, className)} {...props} />; }
