import { useEffect, useMemo, useState } from "react";
import { Cable, Plus } from "lucide-react";
import { ArchitecturePanel } from "@/components/architecture-panel";
import { LabPanel } from "@/components/lab-panel";
import { RegistryTable } from "@/components/registry-table";
import { SourceCard } from "@/components/source-card";
import { VerdictBanner } from "@/components/verdict-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  closeSource,
  connectEvents,
  connectSocket,
  createSource,
  fetchSources,
  openSource,
  reloadSource,
  removeSource,
  type IsolationReport,
  type LiveSource,
} from "@/lib/connector";

type Tab = "sources" | "registry" | "lab" | "architecture";

export function ManagerApp() {
  const [tab, setTab] = useState<Tab>("sources");
  const [online, setOnline] = useState(false);
  const [bridge, setBridge] = useState<"HTTP" | "WebSocket">("HTTP");
  const [sources, setSources] = useState<LiveSource[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState("");
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const [reopened, setReopened] = useState(false);
  const [closedOnce, setClosedOnce] = useState(false);
  const [iso, setIso] = useState<IsolationReport | null>(null);

  useEffect(() => {
    let stop = false;
    const apply = (list: LiveSource[]) => {
      if (stop) return;
      setOnline(true);
      setSources(list);
      setSeen((prev) => {
        const next = { ...prev };
        for (const s of list) next[s.status] = true;
        return next;
      });
    };

    if (!import.meta.env.DEV) {
      setOnline(false);
      setBridge("HTTP");
      return;
    }

    fetchSources()
      .then((r) => apply(r.sources))
      .catch(() => setOnline(false));

    const es = connectEvents((snap) => {
      if (snap.sources) apply(snap.sources);
      if (snap.isolation) setIso(snap.isolation);
    });
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) setOnline(false);
    };

    let ws: WebSocket | null = null;
    try {
      ws = connectSocket((msg) => {
        setBridge("WebSocket");
        if (msg.sources) apply(msg.sources);
      });
      ws.addEventListener("error", () => setBridge("HTTP"));
      ws.addEventListener("close", () => setBridge("HTTP"));
    } catch {
      setBridge("HTTP");
    }

    return () => {
      stop = true;
      es.close();
      ws?.close();
    };
  }, []);

  const tests = useMemo(() => {
    const s1 = sources[0];
    const s2 = sources[1];
    return [
      { n: 1, label: "Tạo Source 01", pass: sources.length >= 1 },
      { n: 2, label: "Mở LIVE Backstage", pass: Boolean(s1 && s1.status === "CONNECTED") },
      { n: 3, label: "Đăng nhập trong Browser Source", pass: s1?.sessionHint === "IN_APP" },
      { n: 4, label: "Tạo Source 02", pass: sources.length >= 2 },
      { n: 5, label: "Đăng nhập tài khoản khác", pass: s2?.sessionHint === "IN_APP" },
      { n: 6, label: "Đóng / mở lại Source", pass: reopened },
      { n: 7, label: "Session 01 ≠ 02", pass: Boolean(iso?.ok) },
      { n: 8, label: "CONNECTED / DISCONNECTED / ERROR", pass: Boolean(seen.CONNECTED && seen.DISCONNECTED && seen.ERROR) },
    ];
  }, [sources, reopened, iso, seen]);

  async function run(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setBanner("");
    try {
      await fn();
    } catch (e) {
      setBanner(String((e as Error).message || e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-svh bg-bg text-fg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <p className="font-mono text-[0.6875rem] tracking-[0.18em] text-muted uppercase">Ban Media</p>
              <h1 className="text-xl font-medium tracking-tight md:text-2xl">LIVE Source Manager</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={online ? "ok" : "live"}>
              <Cable className="size-3" />
              Connector {online ? "ONLINE" : "OFFLINE"}
            </Badge>
            <Badge tone="muted">Bridge {bridge}</Badge>
            <Badge tone="muted">Chromium persistent</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_16.5rem]">
        <div className="space-y-5">
          <VerdictBanner />

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["sources", "LIVE SOURCES"],
                ["registry", "LIVE_SOURCE"],
                ["lab", "LAB"],
                ["architecture", "ARCHITECTURE"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "h-10 rounded-md px-3 text-xs font-medium tracking-wide uppercase transition-colors duration-150",
                  tab === id ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted hover:text-fg",
                )}
              >
                {label}
              </button>
            ))}
            {tab === "sources" ? (
              <Button
                className="ml-auto"
                onClick={() => run("add", async () => void (await createSource()))}
                disabled={Boolean(busyId) || !online}
              >
                <Plus />
                Thêm source
              </Button>
            ) : null}
          </div>

          {banner ? <p className="text-sm text-live">{banner}</p> : null}

          {tab === "sources" ? (
            sources.length === 0 ? (
              <EmptySources
                online={online}
                onAdd={() => run("add", async () => void (await createSource()))}
              />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {sources.map((s) => (
                  <SourceCard
                    key={s.sourceId}
                    source={s}
                    busy={busyId === s.sourceId}
                    onOpen={() =>
                      run(s.sourceId, async () => {
                        await openSource(s.sourceId);
                        if (closedOnce) setReopened(true);
                      })
                    }
                    onReload={() => run(s.sourceId, async () => void (await reloadSource(s.sourceId)))}
                    onClose={() =>
                      run(s.sourceId, async () => {
                        await closeSource(s.sourceId);
                        setClosedOnce(true);
                      })
                    }
                    onRemove={() => run(s.sourceId, async () => void (await removeSource(s.sourceId)))}
                  />
                ))}
              </div>
            )
          ) : null}

          {tab === "registry" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Analog của Sheet LIVE_SOURCE. Đúng cột đã khai báo — không có tiktokId / uid / bmId.
              </p>
              <RegistryTable sources={sources} />
            </div>
          ) : null}

          {tab === "lab" ? (
            <LabPanel
              onIsolation={setIso}
              onErrorSeen={() => setSeen((p) => ({ ...p, ERROR: true }))}
            />
          ) : null}

          {tab === "architecture" ? <ArchitecturePanel /> : null}
        </div>

        <aside className="h-fit rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-4">
          <p className="font-mono text-[0.6875rem] tracking-[0.14em] text-muted uppercase">Prototype tests</p>
          <ol className="mt-3 space-y-2">
            {tests.map((t) => (
              <li key={t.n} className="flex items-start gap-2 text-xs">
                <span
                  className={cn(
                    "mt-0.5 size-2 shrink-0 rounded-full",
                    t.pass ? "bg-ok" : "bg-subtle",
                  )}
                />
                <span className={t.pass ? "text-fg" : "text-muted"}>
                  <span className="font-mono text-subtle">{String(t.n).padStart(2, "0")}</span> {t.label}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted text-pretty">
            Click vào viewport khi CONNECTED để điều khiển Chromium. Đăng nhập trực tiếp trên LIVE
            Backstage. BAN MEDIA không có ô password.
          </p>
        </aside>
      </main>
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-9" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" className="fill-surface-2 stroke-border" />
      <rect x="6" y="7" width="9" height="7" rx="1.5" className="fill-ok/80" />
      <rect x="17" y="7" width="9" height="7" rx="1.5" className="fill-accent/40" />
      <rect x="6" y="17" width="9" height="7" rx="1.5" className="fill-subtle/50" />
      <rect x="17" y="17" width="9" height="7" rx="1.5" className="fill-live/80" />
    </svg>
  );
}

function EmptySources({ onAdd, online }: { onAdd: () => void; online: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <p className="text-base font-medium">
        {online ? "Chưa có LIVE SOURCE" : "Browser Connector offline"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted text-pretty">
        {online
          ? "TEST 1: tạo Source 01. Mỗi source nhận một Chromium profile riêng. Session không dùng chung."
          : "Chromium engine chạy trên máy admin, không trên host tĩnh. Đây là giới hạn thật — không giả lập bằng iframe."}
      </p>
      {online ? (
        <Button className="mt-5" onClick={onAdd}>
          <Plus />
          Thêm source
        </Button>
      ) : null}
    </div>
  );
}
