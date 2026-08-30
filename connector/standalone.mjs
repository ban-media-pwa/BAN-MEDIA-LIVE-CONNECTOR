/**
 * Local studio connector — bind loopback only.
 * Production path for BAN MEDIA: run this next to real Chrome on the admin PC.
 * Google Apps Script cannot spawn this process; the admin machine must.
 */
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createConnector } from "./index.mjs";
import { installConnectorHttp, installConnectorUpgrade } from "./http.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.BAN_CONNECTOR_PORT || 8788);
const host = process.env.BAN_CONNECTOR_HOST || "127.0.0.1";

const engine = await createConnector({
  dataDir: path.join(here, "..", "data"),
});

const server = createServer();
const stack = {
  use(fn) {
    server.on("request", (req, res) => {
      fn(req, res, () => {
        res.statusCode = 404;
        res.end("not found");
      });
    });
  },
};
installConnectorHttp(stack, engine);
installConnectorUpgrade(server, engine);

server.listen(port, host, () => {
  console.log(`[ban-connector] ${host}:${port}`);
  console.log("[ban-connector] Chromium persistent contexts. Not an iframe.");
  console.log("[ban-connector] Credentials stay in data/profiles/*");
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    await engine.shutdown();
    server.close();
    process.exit(0);
  });
}
