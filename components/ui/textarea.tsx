import * as React from "react";
import { cn } from "@/lib/utils";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => <textarea ref={ref} className={cn("min-h-28 w-full resize-y rounded-2xl border border-input bg-background px-4 py-3 text-sm shadow-sm transition placeholder:text-muted-foreground focus:border-ring focus:outline-none", className)} {...props} />); Textarea.displayName = "Textarea";
