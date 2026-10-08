import * as React from "react";
import { cn } from "@/lib/utils";
export function Badge({ className, variant = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "outline" }) { return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", variant === "outline" ? "border border-border bg-background" : "bg-primary text-primary-foreground", className)} {...props} />; }
