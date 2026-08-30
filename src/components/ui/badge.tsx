import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "neutral",
  children,
}: {
  className?: string;
  tone?: "neutral" | "ok" | "live" | "warn" | "muted";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium tracking-wide uppercase",
        tone === "ok" && "bg-ok/15 text-ok",
        tone === "live" && "bg-live/15 text-live",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "muted" && "bg-surface-2 text-muted",
        tone === "neutral" && "bg-surface-2 text-fg",
        className,
      )}
    >
      {children}
    </span>
  );
}
