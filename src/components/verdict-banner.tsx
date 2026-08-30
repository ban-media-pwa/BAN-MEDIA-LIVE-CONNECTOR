export function VerdictBanner() {
  return (
    <section className="rounded-xl border border-live/35 bg-live/10 px-4 py-3 md:px-5">
      <p className="font-mono text-[0.6875rem] tracking-[0.14em] text-live uppercase">Experiment verdict</p>
      <h2 className="mt-1 text-lg font-medium tracking-tight text-balance md:text-xl">
        Không thể thực hiện thuần Google Apps Script Web App.
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-muted text-pretty">
        HtmlService chỉ phát HTML/JS trong một tab. Nó không tạo được Chromium engine, không có
        <span className="text-fg"> user-data-dir </span>
        riêng, không cô lập cookie jar. iframe không phải browser độc lập — TikTok chặn embed, và cùng
        eTLD+1 thì chia sẻ session. Prototype này chạy kiến trúc hybrid: Web App + Browser Connector +
        Chromium persistent context.
      </p>
    </section>
  );
}
