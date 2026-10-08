"use client";
import { Laptop2, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() { const { resolvedTheme, setTheme } = useTheme(); const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []); if (!mounted) return <Button aria-label="Theme" size="icon" variant="ghost"><Laptop2 /></Button>; const next = resolvedTheme === "dark" ? "light" : "dark"; return <Button aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`} size="icon" variant="ghost" onClick={() => setTheme(next)}>{resolvedTheme === "dark" ? <Sun /> : <Moon />}</Button>; }
