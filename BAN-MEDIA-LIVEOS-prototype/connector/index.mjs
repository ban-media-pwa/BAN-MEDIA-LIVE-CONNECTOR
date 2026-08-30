import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine } from "./engine.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

export async function createConnector(opts = {}) {
  const dataDir = opts.dataDir || path.join(here, "..", "data");
  const engine = createEngine(dataDir);
  await engine.init();
  return engine;
}

export { TARGET_URL, VIEWPORT } from "./constants.mjs";
