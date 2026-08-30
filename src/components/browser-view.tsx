import { useEffect, useRef, useState } from "react";
import { MonitorOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { frameUrl, sendInput, type LiveSource } from "@/lib/connector";

export function BrowserView({ source }: { source: LiveSource }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [tick, setTick] = useState(0);
  const [focused, setFocused] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const connected = source.status === "CONNECTED";

  useEffect(() => {
    if (!connected) {
      setBlobUrl(null);
      return;
    }
    let stop = false;
    let current: string | null = null;
    const loop = async () => {
      while (!stop) {
        try {
          const res = await fetch(frameUrl(source.sourceId, Date.now()), { cache: "no-store" });
          if (res.ok && res.status !== 204) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const prev = current;
            current = url;
            setBlobUrl(url);
            if (prev) URL.revokeObjectURL(prev);
          }
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, 280));
      }
    };
    void loop();
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
      if (current) URL.revokeObjectURL(current);
    };
  }, [connected, source.sourceId]);

  function mapPoint(clientX: number, clientY: number) {
    const img = imgRef.current;
    const vp = source.viewport || { width: 1280, height: 720 };
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    const scale = Math.min(rect.width / vp.width, rect.height / vp.height);
    const drawW = vp.width * scale;
    const drawH = vp.height * scale;
    const ox = rect.left + (rect.width - drawW) / 2;
    const oy = rect.top + (rect.height - drawH) / 2;
    return {
      x: Math.max(0, Math.min(vp.width, (clientX - ox) / scale)),
      y: Math.max(0, Math.min(vp.height, (clientY - oy) / scale)),
    };
  }

  function emit(event: Record<string, unknown>) {
    void sendInput(source.sourceId, event).catch(() => {});
  }

  return (
    <div
      ref={shellRef}
      tabIndex={connected ? 0 : -1}
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-md bg-bg",
        connected && "outline-none ring-0 focus-visible:ring-1 focus-visible:ring-accent/50",
      )}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onContextMenu={(e) => {
        if (connected) e.preventDefault();
      }}
      onPointerDown={(e) => {
        if (!connected) return;
        e.currentTarget.focus();
        const { x, y } = mapPoint(e.clientX, e.clientY);
        emit({
          kind: "mouse",
          action: e.detail === 2 ? "dblclick" : "click",
          x,
          y,
          button: e.button === 2 ? "right" : e.button === 1 ? "middle" : "left",
        });
      }}
      onWheel={(e) => {
        if (!connected) return;
        e.preventDefault();
        const { x, y } = mapPoint(e.clientX, e.clientY);
        emit({ kind: "mouse", action: "wheel", x, y, deltaX: e.deltaX, deltaY: e.deltaY });
      }}
      onKeyDown={(e) => {
        if (!connected) return;
        e.preventDefault();
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          emit({ kind: "key", action: "insert", text: e.key, key: e.key });
        } else {
          emit({ kind: "key", action: "press", key: e.key === " " ? "Space" : e.key });
        }
      }}
    >
      {connected && blobUrl ? (
        <img
          ref={imgRef}
          src={blobUrl}
          alt={`${source.sourceName} Chromium viewport`}
          className="size-full object-contain"
          draggable={false}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center">
          <MonitorOff className="size-6 text-subtle" />
          <p className="font-mono text-xs tracking-widest text-subtle uppercase">Browser engine closed</p>
          <p className="max-w-xs text-xs text-muted text-pretty">
            Not an iframe. OPEN launches an isolated Chromium profile and loads LIVE Backstage.
          </p>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
        <span className="rounded-sm bg-bg/80 px-1.5 py-0.5 font-mono text-[0.625rem] tracking-wider text-muted uppercase">
          Chromium engine · not iframe
        </span>
        {focused && connected ? (
          <span className="rounded-sm bg-ok/20 px-1.5 py-0.5 font-mono text-[0.625rem] tracking-wider text-ok uppercase">
            Input captured
          </span>
        ) : null}
      </div>
      {connected ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-bg/80 px-2 py-1 font-mono text-[0.625rem] text-muted">
          {source.pageUrl || "launching…"}
          {tick > 0 && source.pageTitle ? `  ·  ${source.pageTitle}` : ""}
        </div>
      ) : null}
    </div>
  );
}
