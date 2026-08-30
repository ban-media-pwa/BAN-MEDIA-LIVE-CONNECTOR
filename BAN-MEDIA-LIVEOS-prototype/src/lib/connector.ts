export type SourceStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";

export type LiveSource = {
  sourceId: string;
  sourceName: string;
  browserType: string;
  profileName: string;
  status: SourceStatus;
  collectorStatus: string;
  lastConnectedAt: string;
  lastSeenAt: string;
  note: string;
  engine: string;
  iframe: boolean;
  profileDir: string;
  pageUrl: string;
  pageTitle: string;
  viewport: { width: number; height: number };
  cookieCount: number | null;
  sessionHint: "LOGIN_WALL" | "IN_APP" | "UNKNOWN";
  isolationMarker: boolean;
  hasFrame: boolean;
  error: string;
};

export type ConnectorSnapshot = {
  type?: string;
  connector: "ONLINE" | "OFFLINE";
  engine?: string;
  target?: string;
  sources: LiveSource[];
  isolation?: IsolationReport;
};

export type IsolationReport = {
  ok: boolean;
  testedAt?: string;
  reason?: string;
  results: {
    sourceId: string;
    ownMarker: boolean;
    leakedFromPeers: string[];
    pass: boolean;
  }[];
};

export type LabSelfTest = {
  ok: boolean;
  engine: string;
  iframe: boolean;
  profileA_sawOwnMarker: boolean;
  profileB_sawPeerMarker: boolean;
  profileA_cookieCount: number;
  profileB_cookieCount: number;
  conclusion: string;
};

async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; ok?: boolean };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function connectorHealth() {
  const res = await fetch("/api/connector/health");
  if (!res.ok) throw new Error("offline");
  return parse<{ ok: boolean; connector: string; engine: string; iframe: boolean; target: string }>(res);
}

export async function fetchSources() {
  const res = await fetch("/api/connector/sources");
  return parse<{ ok: boolean; sources: LiveSource[] }>(res);
}

export async function createSource(sourceName?: string) {
  const res = await fetch("/api/connector/sources", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sourceName ? { sourceName } : {}),
  });
  return parse<{ ok: boolean; source: LiveSource }>(res);
}

export async function removeSource(sourceId: string, wipe = false) {
  const res = await fetch(`/api/connector/sources/${encodeURIComponent(sourceId)}?wipe=${wipe ? "1" : "0"}`, {
    method: "DELETE",
  });
  return parse<{ ok: boolean }>(res);
}

export async function openSource(sourceId: string) {
  const res = await fetch(`/api/connector/sources/${encodeURIComponent(sourceId)}/open`, { method: "POST" });
  return parse<{ ok: boolean; source: LiveSource }>(res);
}

export async function closeSource(sourceId: string) {
  const res = await fetch(`/api/connector/sources/${encodeURIComponent(sourceId)}/close`, { method: "POST" });
  return parse<{ ok: boolean; source: LiveSource }>(res);
}

export async function reloadSource(sourceId: string) {
  const res = await fetch(`/api/connector/sources/${encodeURIComponent(sourceId)}/reload`, { method: "POST" });
  return parse<{ ok: boolean; source: LiveSource }>(res);
}

export async function sendInput(sourceId: string, event: Record<string, unknown>) {
  const res = await fetch(`/api/connector/sources/${encodeURIComponent(sourceId)}/input`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
  return parse<{ ok: boolean }>(res);
}

export async function runIsolationTest() {
  const res = await fetch("/api/connector/isolation-test", { method: "POST" });
  return parse<IsolationReport & { ok: boolean }>(res);
}

export async function runLabSelfTest() {
  const res = await fetch("/api/connector/lab/self-test", { method: "POST" });
  return parse<LabSelfTest>(res);
}

export async function runErrorDemo() {
  const res = await fetch("/api/connector/lab/error-demo", { method: "POST" });
  return parse<{ status: string; message: string }>(res);
}

export function frameUrl(sourceId: string, tick: number) {
  return `/api/connector/sources/${encodeURIComponent(sourceId)}/frame.jpg?t=${tick}`;
}

export function connectEvents(onSnapshot: (snap: ConnectorSnapshot) => void) {
  const es = new EventSource("/api/connector/events");
  es.addEventListener("snapshot", (ev) => {
    try {
      onSnapshot(JSON.parse((ev as MessageEvent).data) as ConnectorSnapshot);
    } catch {
      /* ignore */
    }
  });
  return es;
}

export function connectSocket(onMessage: (msg: ConnectorSnapshot) => void) {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ban-connector`);
  ws.addEventListener("message", (ev) => {
    try {
      onMessage(JSON.parse(String(ev.data)) as ConnectorSnapshot);
    } catch {
      /* ignore */
    }
  });
  return ws;
}
