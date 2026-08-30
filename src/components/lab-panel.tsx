import { useState } from "react";
import { Button } from "@/components/ui/button";
import { runErrorDemo, runIsolationTest, runLabSelfTest, type IsolationReport, type LabSelfTest } from "@/lib/connector";

export function LabPanel({
  onIsolation,
  onErrorSeen,
}: {
  onIsolation: (r: IsolationReport) => void;
  onErrorSeen: () => void;
}) {
  const [iso, setIso] = useState<IsolationReport | null>(null);
  const [self, setSelf] = useState<LabSelfTest | null>(null);
  const [err, setErr] = useState<{ status: string; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fail, setFail] = useState("");

  async function wrap(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setFail("");
    try {
      await fn();
    } catch (e) {
      setFail(String((e as Error).message || e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted text-pretty">
        Lab chạy trên Chromium persistent context thật. Cookie value không trả về Web App — chỉ boolean
        pass/fail. Self-test tạo hai profile tạm, rồi xóa.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={Boolean(busy)}
          onClick={() =>
            wrap("iso", async () => {
              const r = await runIsolationTest();
              setIso(r);
              onIsolation(r);
            })
          }
        >
          Isolation test (sources đang OPEN)
        </Button>
        <Button
          variant="secondary"
          disabled={Boolean(busy)}
          onClick={() =>
            wrap("self", async () => {
              setSelf(await runLabSelfTest());
            })
          }
        >
          Lab self-test hai profile
        </Button>
        <Button
          variant="danger"
          disabled={Boolean(busy)}
          onClick={() =>
            wrap("err", async () => {
              const r = await runErrorDemo();
              setErr(r);
              if (r.status === "ERROR") onErrorSeen();
            })
          }
        >
          Force Chromium ERROR
        </Button>
      </div>

      {busy ? <p className="font-mono text-xs text-warn">{busy} running…</p> : null}
      {fail ? <p className="text-sm text-live">{fail}</p> : null}

      {self ? (
        <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-4 font-mono text-xs text-fg">
          {JSON.stringify(self, null, 2)}
        </pre>
      ) : null}
      {iso ? (
        <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-4 font-mono text-xs text-fg">
          {JSON.stringify(iso, null, 2)}
        </pre>
      ) : null}
      {err ? (
        <pre className="overflow-x-auto rounded-lg border border-border bg-bg p-4 font-mono text-xs text-fg">
          {JSON.stringify(err, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
