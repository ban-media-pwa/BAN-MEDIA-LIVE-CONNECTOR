import { Loader2, Power, RefreshCw, Square } from "lucide-react";
import { BrowserView } from "@/components/browser-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LiveSource } from "@/lib/connector";

const tone: Record<LiveSource["status"], "ok" | "live" | "warn" | "muted"> = {
  CONNECTED: "ok",
  DISCONNECTED: "muted",
  CONNECTING: "warn",
  ERROR: "live",
};

export function SourceCard({
  source,
  busy,
  onOpen,
  onReload,
  onClose,
  onRemove,
}: {
  source: LiveSource;
  busy?: boolean;
  onOpen: () => void;
  onReload: () => void;
  onClose: () => void;
  onRemove: () => void;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-border bg-surface p-4">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-medium tracking-tight">{source.sourceName}</h2>
          <p className="mt-0.5 font-mono text-xs text-muted">
            {source.browserType} / {source.profileName}
          </p>
        </div>
        <Badge tone={tone[source.status]}>
          <span
            className={cn(
              "size-1.5 rounded-full",
              source.status === "CONNECTED" && "bg-ok",
              source.status === "ERROR" && "bg-live",
              source.status === "CONNECTING" && "bg-warn",
              source.status === "DISCONNECTED" && "bg-subtle",
            )}
          />
          {source.status}
        </Badge>
      </header>

      <BrowserView source={source} />

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[0.6875rem] text-muted">
        <div>
          Cookie entries <span className="text-fg">{source.cookieCount ?? "—"}</span>
        </div>
        <div>
          Hint <span className="text-fg">{source.sessionHint}</span>
        </div>
        <div className="col-span-2 truncate">
          Collector <span className="text-fg">{source.collectorStatus}</span>
          <span className="text-subtle"> · values never leave the profile</span>
        </div>
      </dl>

      {source.error ? <p className="mt-2 text-xs text-live">{source.error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onOpen} disabled={busy || source.status === "CONNECTED" || source.status === "CONNECTING"}>
          {source.status === "CONNECTING" ? <Loader2 className="animate-spin" /> : <Power />}
          OPEN
        </Button>
        <Button size="sm" variant="secondary" onClick={onReload} disabled={busy || source.status !== "CONNECTED"}>
          <RefreshCw />
          RELOAD
        </Button>
        <Button size="sm" variant="secondary" onClick={onClose} disabled={busy || source.status === "DISCONNECTED"}>
          <Square />
          CLOSE
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onRemove} disabled={busy}>
          Remove
        </Button>
      </div>
    </article>
  );
}
