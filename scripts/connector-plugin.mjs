/**
 * Dev-only: embed the Browser Connector in the Vite server so the preview
 * talks to real Chromium persistent contexts on the same origin.
 * Production/Vercel builds omit this plugin — the UI shows CONNECTOR OFFLINE.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

export function connectorPlugin() {
  return {
    name: "ban-media-connector",
    apply: "serve",
    async configureServer(server) {
      const root = server.config.root;
      const mod = await import(pathToFileURL(path.join(root, "connector/index.mjs")).href);
      const httpMod = await import(pathToFileURL(path.join(root, "connector/http.mjs")).href);
      const engine = await mod.createConnector({
        dataDir: path.join(root, "data"),
      });
      // Register before internal/SPA middleware so /api/connector is not swallowed.
      httpMod.installConnectorHttp(server.middlewares, engine);

      const bootUpgrade = () => {
        const httpServer = server.httpServer;
        if (!httpServer || httpServer.__banConnectorUpgrade) return;
        httpServer.__banConnectorUpgrade = true;
        httpMod.installConnectorUpgrade(httpServer, engine);
        httpServer.on("close", () => {
          engine.shutdown();
        });
      };
      bootUpgrade();
      return () => bootUpgrade();
    },
  };
}
