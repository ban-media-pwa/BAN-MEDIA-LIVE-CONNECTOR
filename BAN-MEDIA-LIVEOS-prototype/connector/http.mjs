import { WebSocketServer } from "ws";

/**
 * Connect-style middleware + WebSocket upgrade for the Browser Connector.
 * Same handlers are used by the Vite plugin (dev) and standalone.mjs (local studio).
 */
export function installConnectorHttp(middlewares, engine) {
  middlewares.use(async (req, res, next) => {
    const url = new URL(req.url || "/", "http://connector.local");
    if (!url.pathname.startsWith("/api/connector")) {
      next();
      return;
    }
    try {
      await handle(engine, req, res, url);
    } catch (err) {
      if (!res.headersSent) {
        json(res, 500, { ok: false, error: String(err?.message || err) });
      }
    }
  });
}

export function installConnectorUpgrade(httpServer, engine) {
  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws) => {
    engine.addSocket(ws);
    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(String(data));
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "invalid json" }));
        return;
      }
      engine.dispatchSocket(ws, msg);
    });
  });
  httpServer.on("upgrade", (req, socket, head) => {
    const pathname = (req.url || "").split("?")[0];
    if (pathname !== "/ban-connector") return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });
  return wss;
}

async function handle(engine, req, res, url) {
  const method = (req.method || "GET").toUpperCase();
  const rest = url.pathname.replace(/^\/api\/connector\/?/, "");

  if (method === "OPTIONS") {
    res.statusCode = 204;
    cors(res);
    res.end();
    return;
  }

  if (method === "GET" && (rest === "" || rest === "health")) {
    json(res, 200, {
      ok: true,
      connector: "ONLINE",
      engine: "chromium-persistent-context",
      iframe: false,
      target: engine.TARGET_URL,
      viewport: engine.VIEWPORT,
    });
    return;
  }

  if (method === "GET" && rest === "sources") {
    json(res, 200, { ok: true, sources: engine.listPublic() });
    return;
  }

  if (method === "GET" && rest === "events") {
    sse(res, engine);
    return;
  }

  if (method === "POST" && rest === "sources") {
    const body = await readBody(req);
    const source = await engine.createSource(body);
    json(res, 201, { ok: true, source });
    return;
  }

  if (method === "POST" && rest === "isolation-test") {
    const result = await engine.isolationTest();
    json(res, 200, { ok: true, ...result });
    return;
  }

  if (method === "POST" && rest === "lab/self-test") {
    const result = await engine.labSelfTest();
    json(res, 200, { ok: true, ...result });
    return;
  }

  if (method === "POST" && rest === "lab/error-demo") {
    const result = await engine.labErrorDemo();
    json(res, 200, { ok: true, ...result });
    return;
  }

  const sourceMatch = rest.match(/^sources\/([^/]+)(?:\/(.+))?$/);
  if (sourceMatch) {
    const sourceId = decodeURIComponent(sourceMatch[1]);
    const action = sourceMatch[2] || "";

    if (method === "GET" && action === "frame.jpg") {
      const frame = engine.getFrame(sourceId);
      if (!frame) {
        res.statusCode = 204;
        cors(res);
        res.end();
        return;
      }
      cors(res);
      res.statusCode = 200;
      res.setHeader("content-type", "image/jpeg");
      res.setHeader("cache-control", "no-store, no-cache, must-revalidate");
      res.end(frame);
      return;
    }

    if (method === "DELETE" && action === "") {
      const wipe = url.searchParams.get("wipe") === "1";
      await engine.removeSource(sourceId, { wipeProfile: wipe });
      json(res, 200, { ok: true });
      return;
    }

    if (method === "POST" && action === "open") {
      const source = await engine.openSource(sourceId);
      json(res, 200, { ok: true, source });
      return;
    }
    if (method === "POST" && action === "close") {
      const source = await engine.closeSource(sourceId);
      json(res, 200, { ok: true, source });
      return;
    }
    if (method === "POST" && action === "reload") {
      const source = await engine.reloadSource(sourceId);
      json(res, 200, { ok: true, source });
      return;
    }
    if (method === "POST" && action === "input") {
      const body = await readBody(req);
      const result = await engine.handleInput(sourceId, body);
      json(res, 200, { ok: true, ...result });
      return;
    }
  }

  json(res, 404, { ok: false, error: "unknown connector route" });
}

function sse(res, engine) {
  cors(res);
  res.statusCode = 200;
  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache, no-transform");
  res.setHeader("connection", "keep-alive");
  res.flushHeaders?.();
  const send = (chunk) => {
    res.write(chunk);
  };
  const remove = engine.addSse(send);
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  res.on("close", () => {
    clearInterval(ping);
    remove();
  });
}

function json(res, status, body) {
  cors(res);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function cors(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid json"));
      }
    });
    req.on("error", reject);
  });
}
