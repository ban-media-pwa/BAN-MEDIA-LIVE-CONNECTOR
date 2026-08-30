import { EventEmitter } from "node:events";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { TARGET_URL, VIEWPORT, LAUNCH_OPTIONS } from "./constants.mjs";
import { createStore, emptySource } from "./store.mjs";

/**
 * Real Chromium engine manager.
 * Each LIVE SOURCE = one launchPersistentContext(user-data-dir).
 * Cookie jars never leave this process. The Web App only receives
 * status, URL/title, a JPEG frame, and isolation booleans.
 */
export function createEngine(dataDir) {
  const store = createStore(dataDir);
  const profilesRoot = path.join(dataDir, "profiles");
  const bus = new EventEmitter();
  bus.setMaxListeners(50);

  /** @type {Map<string, object>} */
  const rows = new Map();
  /** @type {Map<string, Session>} */
  const sessions = new Map();
  /** @type {Set<(chunk: string) => void>} */
  const sseClients = new Set();
  /** @type {Set<import('ws').WebSocket>} */
  const sockets = new Set();

  const locks = new Map();

  async function init() {
    await mkdir(profilesRoot, { recursive: true });
    const { sources } = await store.read();
    for (const row of sources) {
      rows.set(row.sourceId, {
        ...row,
        status: row.status === "CONNECTED" || row.status === "CONNECTING" ? "DISCONNECTED" : row.status,
        collectorStatus: "IDLE",
      });
    }
    await persist();
    broadcast();
  }

  function listPublic() {
    return [...rows.values()].map(toPublic);
  }

  function getPublic(id) {
    const row = rows.get(id);
    return row ? toPublic(row) : null;
  }

  function toPublic(row) {
    const session = sessions.get(row.sourceId);
    return {
      ...row,
      engine: "chromium-persistent-context",
      iframe: false,
      profileDir: profileDirName(row.sourceId),
      pageUrl: session?.pageUrl ?? "",
      pageTitle: session?.pageTitle ?? "",
      viewport: VIEWPORT,
      cookieCount: session?.cookieCount ?? null,
      sessionHint: session?.sessionHint ?? "UNKNOWN",
      isolationMarker: session?.isolationMarker ?? false,
      hasFrame: Boolean(session?.frame),
      error: session?.error || (row.status === "ERROR" ? row.note : ""),
    };
  }

  function profileDirName(sourceId) {
    return path.join("profiles", sourceId);
  }

  function profileAbs(sourceId) {
    return path.join(profilesRoot, sourceId);
  }

  function nextIds() {
    let n = 1;
    const used = new Set(rows.keys());
    while (used.has(`SRC-${String(n).padStart(2, "0")}`)) n += 1;
    const num = String(n).padStart(2, "0");
    return {
      sourceId: `SRC-${num}`,
      sourceName: `LIVE SOURCE ${num}`,
      profileName: `Profile ${num}`,
    };
  }

  async function persist() {
    await store.write([...rows.values()]);
  }

  function broadcast(extra) {
    const payload = {
      type: "snapshot",
      connector: "ONLINE",
      engine: "chromium",
      target: TARGET_URL,
      sources: listPublic(),
      ...extra,
    };
    const json = JSON.stringify(payload);
    for (const send of sseClients) send(`event: snapshot\ndata: ${json}\n\n`);
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(json);
    }
    bus.emit("snapshot", payload);
  }

  async function withLock(id, fn) {
    const prev = locks.get(id) ?? Promise.resolve();
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    locks.set(
      id,
      prev.then(() => gate),
    );
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async function createSource(input = {}) {
    const ids = nextIds();
    const sourceId = ids.sourceId;
    const row = emptySource({
      sourceId,
      sourceName: String(input.sourceName || ids.sourceName).slice(0, 80),
      profileName: ids.profileName,
      note: "Isolated Chromium profile. Credentials stay in this profile only.",
    });
    rows.set(sourceId, row);
    const dir = profileAbs(sourceId);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "BAN_MEDIA_PROFILE.json"),
      JSON.stringify(
        {
          sourceId,
          profileName: row.profileName,
          createdAt: new Date().toISOString(),
          engine: "chromium-persistent-context",
          warning: "Cookie database lives inside this directory. Do not upload.",
        },
        null,
        2,
      ),
      "utf8",
    );
    await persist();
    broadcast();
    return toPublic(row);
  }

  async function removeSource(sourceId, { wipeProfile = false } = {}) {
    await closeSource(sourceId);
    rows.delete(sourceId);
    if (wipeProfile) {
      const dir = profileAbs(sourceId);
      if (existsSync(dir)) await rm(dir, { recursive: true, force: true });
    }
    await persist();
    broadcast();
  }

  async function openSource(sourceId) {
    return withLock(sourceId, () => openSourceLocked(sourceId));
  }

  async function openSourceLocked(sourceId) {
    const row = rows.get(sourceId);
    if (!row) throw new Error("Source not found");
    if (sessions.has(sourceId)) {
      const s = sessions.get(sourceId);
      if (s.context) return toPublic(row);
    }

    row.status = "CONNECTING";
    row.note = "Launching isolated Chromium profile…";
    await persist();
    broadcast();

    const dir = profileAbs(sourceId);
    await mkdir(dir, { recursive: true });

    try {
      const context = await chromium.launchPersistentContext(dir, {
        ...LAUNCH_OPTIONS,
      });
      await context.addInitScript(
        (marker) => {
          Object.defineProperty(window, "__BAN_MEDIA_SOURCE", {
            value: Object.freeze(marker),
            configurable: false,
          });
        },
        { sourceId, profileName: row.profileName },
      );

      let page = context.pages()[0] || (await context.newPage());
      const session = {
        context,
        page,
        frame: null,
        pageUrl: "",
        pageTitle: "",
        cookieCount: 0,
        sessionHint: "UNKNOWN",
        isolationMarker: true,
        error: "",
        stopped: false,
        loop: null,
      };
      sessions.set(sourceId, session);

      const attachPage = async (next) => {
        session.page = next;
        next.setViewportSize(VIEWPORT).catch(() => {});
        next.on("framenavigated", (frame) => {
          if (frame === next.mainFrame()) refreshMeta(sourceId).catch(() => {});
        });
        next.on("popup", (popup) => {
          attachPage(popup).catch(() => {});
        });
      };

      context.on("page", (p) => {
        attachPage(p).catch(() => {});
      });

      await attachPage(page);

      try {
        await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
      } catch (err) {
        session.error = String(err?.message || err).slice(0, 180);
      }

      row.status = "CONNECTED";
      row.collectorStatus = "ARMED";
      row.lastConnectedAt = new Date().toISOString();
      row.lastSeenAt = row.lastConnectedAt;
      row.note = session.error ? `Engine up. Navigation: ${session.error}` : "Chromium profile running.";
      await refreshMeta(sourceId);
      startFrameLoop(sourceId);
      await persist();
      broadcast();
      return toPublic(row);
    } catch (err) {
      const message = String(err?.message || err).slice(0, 220);
      row.status = "ERROR";
      row.collectorStatus = "IDLE";
      row.note = message;
      sessions.delete(sourceId);
      await persist();
      broadcast();
      throw Object.assign(new Error(message), { exposed: true });
    }
  }

  async function closeSource(sourceId) {
    return withLock(sourceId, () => closeSourceLocked(sourceId));
  }

  async function closeSourceLocked(sourceId) {
    const session = sessions.get(sourceId);
    const row = rows.get(sourceId);
    if (session) {
      session.stopped = true;
      if (session.loop) clearTimeout(session.loop);
      try {
        await session.context.close();
      } catch {
        /* ignore */
      }
      sessions.delete(sourceId);
    }
    if (row) {
      row.status = "DISCONNECTED";
      row.collectorStatus = "IDLE";
      row.lastSeenAt = new Date().toISOString();
      row.note = "Engine closed. Profile + cookies remain on local disk.";
      await persist();
    }
    broadcast();
    return row ? toPublic(row) : null;
  }

  async function reloadSource(sourceId) {
    const session = sessions.get(sourceId);
    if (!session?.page) throw new Error("Source is not connected");
    try {
      await session.page.reload({ waitUntil: "domcontentloaded", timeout: 45000 });
    } catch (err) {
      session.error = String(err?.message || err).slice(0, 180);
    }
    await refreshMeta(sourceId);
    broadcast();
    return getPublic(sourceId);
  }

  async function refreshMeta(sourceId) {
    const session = sessions.get(sourceId);
    const row = rows.get(sourceId);
    if (!session?.page || !row) return;
    try {
      session.pageUrl = session.page.url();
      session.pageTitle = await session.page.title();
      const cookies = await session.context.cookies();
      session.cookieCount = cookies.length;
      const loginBtns = await session.page.getByRole("button", { name: /log in|đăng nhập/i }).count();
      const loginLinks = await session.page.getByRole("link", { name: /log in|đăng nhập/i }).count();
      const loginText = await session.page.getByText(/^(Log in|Đăng nhập)$/i).count();
      const loginWall = loginBtns + loginLinks + loginText > 0;
      const onBackstage = /live-backstage\.tiktok\.com/i.test(session.pageUrl);
      const onLogin = /\/login/i.test(session.pageUrl);
      if (loginWall || onLogin) session.sessionHint = "LOGIN_WALL";
      else if (onBackstage) session.sessionHint = "IN_APP";
      else session.sessionHint = "UNKNOWN";
      session.isolationMarker = await session.page
        .evaluate(() => Boolean(window.__BAN_MEDIA_SOURCE?.sourceId))
        .catch(() => false);
      row.lastSeenAt = new Date().toISOString();
    } catch {
      /* page may be mid-navigation */
    }
  }

  function startFrameLoop(sourceId) {
    const session = sessions.get(sourceId);
    if (!session) return;
    let n = 0;
    const tick = async () => {
      if (session.stopped || sessions.get(sourceId) !== session) return;
      try {
        if (session.page && !session.page.isClosed()) {
          session.frame = await session.page.screenshot({
            type: "jpeg",
            quality: 42,
            timeout: 4000,
          });
          rowTouch(sourceId);
          n += 1;
          if (n % 8 === 0) {
            await refreshMeta(sourceId);
            broadcast();
          }
        }
      } catch {
        /* swallow screenshot races */
      }
      session.loop = setTimeout(tick, 280);
    };
    tick();
  }

  function rowTouch(sourceId) {
    const row = rows.get(sourceId);
    if (row) row.lastSeenAt = new Date().toISOString();
  }

  function getFrame(sourceId) {
    return sessions.get(sourceId)?.frame ?? null;
  }

  async function handleInput(sourceId, event) {
    const session = sessions.get(sourceId);
    if (!session?.page || session.page.isClosed()) throw new Error("Source is not connected");
    const page = session.page;
    const kind = event?.kind;
    if (kind === "mouse") {
      const x = clamp(Number(event.x), 0, VIEWPORT.width);
      const y = clamp(Number(event.y), 0, VIEWPORT.height);
      const button = event.button === "right" ? "right" : event.button === "middle" ? "middle" : "left";
      if (event.action === "move") await page.mouse.move(x, y);
      else if (event.action === "down") await page.mouse.down({ button });
      else if (event.action === "up") await page.mouse.up({ button });
      else if (event.action === "click") await page.mouse.click(x, y, { button });
      else if (event.action === "dblclick") await page.mouse.dblclick(x, y, { button });
      else if (event.action === "wheel") {
        await page.mouse.move(x, y);
        await page.mouse.wheel(Number(event.deltaX) || 0, Number(event.deltaY) || 0);
      }
      return { ok: true };
    }
    if (kind === "key") {
      const key = sanitizeKey(event.key);
      if (!key) return { ok: false };
      if (event.action === "insert" && event.text) {
        await page.keyboard.insertText(String(event.text).slice(0, 16));
      } else if (event.action === "down") await page.keyboard.down(key);
      else if (event.action === "up") await page.keyboard.up(key);
      else await page.keyboard.press(key);
      return { ok: true };
    }
    return { ok: false };
  }

  /**
   * Isolation proof: plant a marker cookie per connected profile on example.com
   * and verify no peer profile can see it. Cookie VALUES are never returned.
   */
  async function isolationTest() {
    const connected = [...sessions.entries()].filter(([, s]) => s.context);
    if (connected.length < 1) {
      return { ok: false, reason: "Open at least one source.", results: [] };
    }
    for (const [id, session] of connected) {
      await session.context.addCookies([
        {
          name: `ban_iso_${id}`,
          value: "local-only",
          url: "https://example.com/",
        },
      ]);
    }
    const results = [];
    for (const [id, session] of connected) {
      const cookies = await session.context.cookies("https://example.com/");
      const names = cookies.map((c) => c.name);
      const leakedFrom = connected
        .map(([peer]) => peer)
        .filter((peer) => peer !== id && names.includes(`ban_iso_${peer}`));
      const own = names.includes(`ban_iso_${id}`);
      results.push({
        sourceId: id,
        ownMarker: own,
        leakedFromPeers: leakedFrom,
        pass: own && leakedFrom.length === 0,
      });
    }
    const payload = {
      ok: results.every((r) => r.pass),
      testedAt: new Date().toISOString(),
      results,
    };
    broadcast({ isolation: payload });
    return payload;
  }

  /**
   * Lab: two throwaway persistent contexts, prove cookie jars do not mix,
   * then destroy them. Does not touch LIVE SOURCE profiles.
   */
  async function labSelfTest() {
    const stamp = Date.now();
    const dirA = path.join(dataDir, "lab", `A-${stamp}`);
    const dirB = path.join(dataDir, "lab", `B-${stamp}`);
    await mkdir(dirA, { recursive: true });
    await mkdir(dirB, { recursive: true });
    let ctxA;
    let ctxB;
    try {
      ctxA = await chromium.launchPersistentContext(dirA, { ...LAUNCH_OPTIONS });
      ctxB = await chromium.launchPersistentContext(dirB, { ...LAUNCH_OPTIONS });
      const pageA = ctxA.pages()[0] || (await ctxA.newPage());
      const pageB = ctxB.pages()[0] || (await ctxB.newPage());
      await pageA.goto("https://example.com/", { waitUntil: "domcontentloaded", timeout: 20000 });
      await ctxA.addCookies([{ name: "ban_marker", value: "SOURCE_A_ONLY", url: "https://example.com/" }]);
      await pageA.reload({ waitUntil: "domcontentloaded" });
      await pageB.goto("https://example.com/", { waitUntil: "domcontentloaded", timeout: 20000 });
      const aHas = await pageA.evaluate(() => document.cookie.includes("ban_marker"));
      const bHas = await pageB.evaluate(() => document.cookie.includes("ban_marker"));
      const aCount = (await ctxA.cookies()).length;
      const bCount = (await ctxB.cookies()).length;
      return {
        ok: aHas && !bHas,
        engine: "chromium-persistent-context",
        iframe: false,
        profileA_sawOwnMarker: aHas,
        profileB_sawPeerMarker: bHas,
        profileA_cookieCount: aCount,
        profileB_cookieCount: bCount,
        conclusion: aHas && !bHas ? "PASS — isolated cookie jars" : "FAIL — leak detected",
      };
    } finally {
      try {
        await ctxA?.close();
      } catch {
        /* ignore */
      }
      try {
        await ctxB?.close();
      } catch {
        /* ignore */
      }
      await rm(path.join(dataDir, "lab"), { recursive: true, force: true }).catch(() => {});
    }
  }

  async function labErrorDemo() {
    const stamp = Date.now();
    const dir = path.join(dataDir, "lab", `ERR-${stamp}`);
    await mkdir(dir, { recursive: true });
    try {
      await chromium.launchPersistentContext(dir, {
        ...LAUNCH_OPTIONS,
        executablePath: "/nonexistent/chromium-binary",
      });
      return { status: "CONNECTED", message: "unexpected success" };
    } catch (err) {
      return {
        status: "ERROR",
        message: String(err?.message || err).slice(0, 220),
      };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  function addSse(send) {
    sseClients.add(send);
    send(`event: snapshot\ndata: ${JSON.stringify({ type: "snapshot", connector: "ONLINE", sources: listPublic() })}\n\n`);
    return () => sseClients.delete(send);
  }

  function addSocket(ws) {
    sockets.add(ws);
    ws.send(JSON.stringify({ type: "hello", connector: "ONLINE", sources: listPublic() }));
    ws.on("close", () => sockets.delete(ws));
    ws.on("error", () => sockets.delete(ws));
  }

  async function dispatchSocket(ws, msg) {
    const type = msg?.type;
    try {
      if (type === "hello") {
        ws.send(JSON.stringify({ type: "hello", connector: "ONLINE", sources: listPublic() }));
        return;
      }
      if (type === "createSource") {
        const source = await createSource(msg);
        ws.send(JSON.stringify({ type: "source", source }));
        return;
      }
      if (type === "open") {
        ws.send(JSON.stringify({ type: "source", source: await openSource(msg.sourceId) }));
        return;
      }
      if (type === "close") {
        ws.send(JSON.stringify({ type: "source", source: await closeSource(msg.sourceId) }));
        return;
      }
      if (type === "reload") {
        ws.send(JSON.stringify({ type: "source", source: await reloadSource(msg.sourceId) }));
        return;
      }
      if (type === "input") {
        await handleInput(msg.sourceId, msg.event);
        return;
      }
      if (type === "isolationTest") {
        ws.send(JSON.stringify({ type: "isolation", ...(await isolationTest()) }));
        return;
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", message: String(err?.message || err) }));
    }
  }

  async function shutdown() {
    const ids = [...sessions.keys()];
    for (const id of ids) {
      try {
        await closeSource(id);
      } catch {
        /* ignore */
      }
    }
  }

  return {
    init,
    listPublic,
    getPublic,
    createSource,
    removeSource,
    openSource,
    closeSource,
    reloadSource,
    getFrame,
    handleInput,
    isolationTest,
    labSelfTest,
    labErrorDemo,
    addSse,
    addSocket,
    dispatchSocket,
    shutdown,
    bus,
    store,
    TARGET_URL,
    VIEWPORT,
  };
}

function clamp(n, min, max) {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function sanitizeKey(key) {
  if (typeof key !== "string" || !key) return "";
  if (key.length === 1) return key;
  const allowed = new Set([
    "Enter",
    "Tab",
    "Escape",
    "Backspace",
    "Delete",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "Shift",
    "Control",
    "Alt",
    "Meta",
    "Space",
    "CapsLock",
  ]);
  if (allowed.has(key)) return key === "Space" ? " " : key;
  if (/^F\d{1,2}$/.test(key)) return key;
  return "";
}

/**
 * @typedef {object} Session
 * @property {import('playwright').BrowserContext} context
 * @property {import('playwright').Page} page
 * @property {Buffer | null} frame
 * @property {string} pageUrl
 * @property {string} pageTitle
 * @property {number} cookieCount
 * @property {string} sessionHint
 * @property {boolean} isolationMarker
 * @property {string} error
 * @property {boolean} stopped
 * @property {NodeJS.Timeout | null} loop
 */
