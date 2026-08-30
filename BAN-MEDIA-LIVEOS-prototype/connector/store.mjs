import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { SHEET_COLUMNS } from "./constants.mjs";

/**
 * LIVE_SOURCE sheet analog. Exact columns only — no tiktokId / uid / tokens.
 */
export function createStore(dataDir) {
  const sheetPath = path.join(dataDir, "LIVE_SOURCE.json");

  /** @returns {Promise<{ sources: object[] }>} */
  async function read() {
    if (!existsSync(sheetPath)) {
      return { sources: [] };
    }
    const raw = await readFile(sheetPath, "utf8");
    try {
      const parsed = JSON.parse(raw);
      const sources = Array.isArray(parsed.sources) ? parsed.sources : [];
      return { sources: sources.map(sanitizeRow) };
    } catch {
      return { sources: [] };
    }
  }

  /** @param {object[]} sources */
  async function write(sources) {
    await mkdir(dataDir, { recursive: true });
    const payload = {
      sheet: "LIVE_SOURCE",
      columns: SHEET_COLUMNS,
      updatedAt: new Date().toISOString(),
      sources: sources.map(sanitizeRow),
    };
    await writeFile(sheetPath, JSON.stringify(payload, null, 2), "utf8");
  }

  return { sheetPath, read, write };
}

function sanitizeRow(row) {
  const out = {};
  for (const col of SHEET_COLUMNS) {
    out[col] = row?.[col] ?? (col.endsWith("At") ? "" : col === "note" ? "" : "");
  }
  return out;
}

export function emptySource(partial) {
  return sanitizeRow({
    sourceId: partial.sourceId,
    sourceName: partial.sourceName,
    browserType: "Chromium",
    profileName: partial.profileName,
    status: "DISCONNECTED",
    collectorStatus: "IDLE",
    lastConnectedAt: "",
    lastSeenAt: "",
    note: partial.note ?? "",
  });
}
