export function ArchitecturePanel() {
  return (
    <div className="space-y-8 text-sm leading-relaxed text-muted">
      <section className="space-y-3">
        <h2 className="text-lg font-medium text-fg">1. Giới hạn kỹ thuật</h2>
        <p>
          Google Apps Script Web App (HtmlService) chạy trong iframe sandbox của
          <span className="text-fg"> script.google.com / googleusercontent.com</span>. Đó là một trang web,
          không phải một browser engine.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Không có API để spawn Chrome/Chromium hay WebView.</li>
          <li>Không có <span className="font-mono text-fg">--user-data-dir</span> / isolated cookie jar.</li>
          <li>Không có Chrome DevTools Protocol từ GAS.</li>
          <li>
            <span className="text-fg">UrlFetchApp</span> là HTTP server-side từ máy Google — không chạy JS
            của LIVE Backstage, không giữ session đăng nhập của admin.
          </li>
          <li>
            iframe lồng TikTok bị chặn (frame-ancestors / X-Frame-Options). Dù embed được, iframe cùng
            eTLD+1 chia sẻ cookie — Source 01 và Source 02 sẽ đụng một tài khoản.
          </li>
          <li>
            GAS HTTPS không gọi được <span className="font-mono text-fg">ws://127.0.0.1</span> (mixed
            content). Muốn bridge local phải có process chạy trên máy admin.
          </li>
        </ul>
        <p className="text-fg">
          Kết luận: không thể tạo Browser Source độc lập thuần GAS Web App. iframe không được xem là
          browser độc lập.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-fg">2. Kiến trúc hybrid đang chạy</h2>
        <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-4 font-mono text-xs text-fg">
{`BAN MEDIA WEB APP  (control plane)
        │  HTTP / SSE / WebSocket  — không cookie, không token
        ▼
BROWSER CONNECTOR  (Node + Playwright)
        │  launchPersistentContext(user-data-dir)
        ▼
CHROMIUM PROFILE 01..04  (cookie jar riêng trên đĩa local)
        │
        ▼
https://live-backstage.tiktok.com/
Admin đăng nhập trực tiếp trong engine (QR / form của TikTok).`}
        </pre>
        <p>
          Web App chỉ nhận: trạng thái CONNECTED / DISCONNECTED / ERROR, URL/title, số lượng cookie (không
          tên/giá trị), JPEG viewport, và boolean isolation. Password, cookie, session id, access token
          không rời profile directory.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-fg">3. Cấu trúc project (module độc lập)</h2>
        <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-4 font-mono text-xs text-fg">
{`connector/engine.mjs     Chromium persistent contexts
connector/http.mjs        REST + SSE + WebSocket /ban-connector
connector/store.mjs       LIVE_SOURCE analog (đúng cột Sheet)
connector/standalone.mjs  Bind 127.0.0.1:8788 cho studio local
data/LIVE_SOURCE.json     Registry
data/profiles/SRC-xx/     Cookie DB của từng source
gas/                      Apps Script companion — không spawn browser
src/                      LIVE Source Manager UI`}
        </pre>
        <p>
          Không đụng BAN MEDIA V2.1. Collector chưa đọc KPI LIVE — chỉ để <span className="text-fg">ARMED</span>{" "}
          khi engine sống, sẵn sàng đọc DOM/network mà Backstage thực sự render cho session admin.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-fg">4. Những gì không làm được thuần Web App</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Embed LIVE Backstage trong thẻ iframe của GAS hoặc của web app.</li>
          <li>Giữ 4 phiên TikTok độc lập trong một tab trình duyệt.</li>
          <li>Đăng nhập TikTok bằng form của BAN MEDIA (cấm — và không cần).</li>
          <li>Đọc cookie/token từ trang TikTok rồi gửi lên Sheet.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-fg">5. Production trên máy admin</h2>
        <p>
          Studio thật: chạy connector local, mỗi source là Chrome với user-data-dir riêng (cửa sổ thật —
          captcha/2FA/QR ổn định hơn headless). GAS chỉ giữ Sheet LIVE_SOURCE (status). UI control plane
          nên phục vụ từ localhost hoặc Electron, không từ script.google.com, nếu muốn nhúng viewport.
        </p>
      </section>
    </div>
  );
}
