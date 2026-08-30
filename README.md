# BAN MEDIA LIVE CONNECTOR

Browser Connector cục bộ cho BAN MEDIA LIVEOS.

## Kiến trúc

Google Apps Script Web App
→ Browser Connector cục bộ
→ Chromium persistent profiles
→ LIVE Backstage

## Yêu cầu

- Node.js 20 trở lên
- npm
- Máy Admin có quyền chạy ứng dụng cục bộ

## Cài đặt

Mở Terminal / PowerShell tại thư mục dự án:

```bash
npm install
```

Cài Chromium của Playwright:

```bash
npx playwright install chromium
```

## Chạy Connector

```bash
npm start
```

Mặc định Connector chạy tại:

```text
http://127.0.0.1:8787
```

Kiểm tra:

```text
http://127.0.0.1:8787/health
```

## Browser Profiles

Khi mở Source, Connector tự tạo:

```text
profiles/
├── LS-001/
├── LS-002/
├── LS-003/
└── LS-004/
```

Mỗi Source có persistent profile riêng.

Ví dụ:

```text
LS-001 → Profile LS-001 → Account A
LS-002 → Profile LS-002 → Account B
```

Không dùng chung profile giữa các Source.

## Bảo mật

Không lưu trong repository:

- Password
- Cookie
- Session ID
- Access Token
- Credential TikTok

Không commit thư mục `profiles/` lên GitHub.

Nên thêm `profiles/` vào `.gitignore` trước khi chạy production.

## Trạng thái hiện tại

Prototype hỗ trợ:

- Localhost connector
- Chromium thật
- Persistent browser context
- Profile isolation
- Mở LIVE Backstage
- Đóng/mở lại profile
- API status
- API open
- API reload
- API close
- Health check

Collector KPI LIVE chưa được triển khai.

Chỉ đọc dữ liệu mà LIVE Backstage thực sự render/cung cấp ở bước Collector sau này; không giả định API ẩn.

## Các Source mặc định

- LS-001 — Chrome — BANMEDIA-LIVE-01
- LS-002 — Chrome — BANMEDIA-LIVE-02
- LS-003 — Cốc Cốc — BANMEDIA-LIVE-03
- LS-004 — Edge — BANMEDIA-LIVE-04

## Lưu ý

`server.js` hiện dùng Chromium do Playwright quản lý để prototype Browser Connector. Việc lựa chọn binary trình duyệt cụ thể như Chrome/Cốc Cốc/Edge thật sẽ được xử lý ở bước Connector nâng cao, không được giả định chỉ từ trường `browserType`.

Module này độc lập với BAN MEDIA V2.1.
