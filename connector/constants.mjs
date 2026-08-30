export const TARGET_URL = "https://live-backstage.tiktok.com/";

export const VIEWPORT = { width: 1280, height: 720 };

export const SHEET_COLUMNS = [
  "sourceId",
  "sourceName",
  "browserType",
  "profileName",
  "status",
  "collectorStatus",
  "lastConnectedAt",
  "lastSeenAt",
  "note",
];

export const STATUSES = /** @type {const} */ ([
  "DISCONNECTED",
  "CONNECTING",
  "CONNECTED",
  "ERROR",
]);

export const LAUNCH_OPTIONS = {
  headless: true,
  viewport: VIEWPORT,
  locale: "en-US",
  timezoneId: "Asia/Ho_Chi_Minh",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  args: [
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--window-size=1280,720",
  ],
  ignoreDefaultArgs: ["--enable-automation"],
  acceptDownloads: false,
  bypassCSP: false,
};
