import type { LiveSource } from "@/lib/connector";

const COLS = [
  "sourceId",
  "sourceName",
  "browserType",
  "profileName",
  "status",
  "collectorStatus",
  "lastConnectedAt",
  "lastSeenAt",
  "note",
] as const;

export function RegistryTable({ sources }: { sources: LiveSource[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">LIVE_SOURCE sheet analog</caption>
        <thead className="bg-surface-2 font-mono text-[0.6875rem] tracking-wider text-muted uppercase">
          <tr>
            {COLS.map((col) => (
              <th key={col} className="border-b border-border px-3 py-2 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sources.length === 0 ? (
            <tr>
              <td colSpan={COLS.length} className="px-3 py-8 text-center text-muted">
                Sheet trống. Tạo source để ghi dòng LIVE_SOURCE.
              </td>
            </tr>
          ) : (
            sources.map((s) => (
              <tr key={s.sourceId} className="border-b border-border last:border-0">
                <td className="max-w-40 truncate px-3 py-2 font-mono text-fg">{s.sourceId}</td>
                <td className="max-w-40 truncate px-3 py-2 font-mono text-fg">{s.sourceName}</td>
                <td className="px-3 py-2 font-mono text-fg">{s.browserType}</td>
                <td className="px-3 py-2 font-mono text-fg">{s.profileName}</td>
                <td className="px-3 py-2 font-mono text-fg">{s.status}</td>
                <td className="px-3 py-2 font-mono text-fg">{s.collectorStatus}</td>
                <td className="px-3 py-2 font-mono text-fg">{format(s.lastConnectedAt)}</td>
                <td className="px-3 py-2 font-mono text-fg">{format(s.lastSeenAt)}</td>
                <td className="max-w-56 truncate px-3 py-2 font-mono text-fg">{format(s.note)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function format(value: string) {
  if (!value) return "—";
  if (/^\d{4}-/.test(value)) {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }
  return value;
}
