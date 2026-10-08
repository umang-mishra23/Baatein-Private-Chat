import * as React from "react";
import { cn } from "@/lib/utils";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} className={cn("h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm shadow-sm transition placeholder:text-muted-foreground focus:border-ring focus:outline-none", className)} {...props} />); Input.displayName = "Input";
