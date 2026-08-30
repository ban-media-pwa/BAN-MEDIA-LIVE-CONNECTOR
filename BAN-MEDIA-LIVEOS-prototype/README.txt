BAN MEDIA LIVEOS — prototype source
===================================

Không thể thực hiện thuần Google Apps Script Web App.
Hybrid: Web App + Browser Connector + Chromium persistent context.

CẤU TRÚC
--------
connector/                 Chromium engine (Playwright persistent context)
  constants.mjs
  store.mjs
  engine.mjs               Isolated user-data-dir per LIVE SOURCE
  http.mjs                 REST + SSE + WebSocket /ban-connector
  index.mjs
  standalone.mjs           Connector độc lập cho máy admin
gas/                       Apps Script companion (registry only)
  Code.gs
  Index.html
  appsscript.json
src/                       LIVE Source Manager UI
scripts/connector-plugin.mjs
data/LIVE_SOURCE.json      Sheet analog — KHÔNG chứa cookie/token

BẢO MẬT
-------
Không đóng gói data/profiles/ (cookie jar Chromium).
Không gửi password / cookie / session id / access token lên server.

CHẠY CONNECTOR LOCAL (máy admin)
--------------------------------
1. Node 22
2. npm install
3. npx playwright install chromium
4. node connector/standalone.mjs
5. Mở Web App, OPEN từng LIVE SOURCE, đăng nhập trực tiếp trên LIVE Backstage

GAS
---
gas/ chỉ giữ Sheet LIVE_SOURCE. HtmlService không tạo browser độc lập.
Không iframe live-backstage.tiktok.com.
