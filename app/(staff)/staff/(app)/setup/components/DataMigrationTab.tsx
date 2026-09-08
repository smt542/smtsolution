"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MIGRATION_GROUPS, DEP, type EntitySchema } from "./dataMigration/schemas";
import { downloadCsv, buildTemplateRows } from "./dataMigration/csv";
import { BulkImportModal } from "./BulkImportModal";

const LOG_KEY = "erp_migrate_log";
type LogEntry = { n: number; at: string };
type Log = Record<string, LogEntry>;

function readLog(): Log {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || "{}") as Log; } catch { return {}; }
}
function writeLog(log: Log) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch { /* ignore */ }
}
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function DataMigrationTab() {
  const [log, setLog] = useState<Log>({});
  const [active, setActive] = useState<{ kind: string; schema: EntitySchema } | null>(null);

  useEffect(() => { setLog.call(undefined, readLog()); }, []);

  const isLocked = (kind: string) => (DEP[kind] ?? []).some((d) => !log[d]);

  const onImported = (ok: number) => {
    if (!active) return;
    setLog((prev) => {
      const next = { ...prev, [active.kind]: { n: ok, at: today() } };
      writeLog(next);
      return next;
    });
  };

  const resetLog = () => { writeLog({}); setLog({}); toast.success("진행 기록을 초기화했어요"); };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0">
          <div className="text-base font-extrabold text-t1">데이터 이관</div>
          <div className="mt-1 text-sm text-t3">기존 서비스의 데이터를 엑셀로 옮겨요. 아래 순서대로 진행해야 참조가 어긋나지 않습니다.</div>
        </div>
        <div className="flex-1" />
        <button type="button" onClick={resetLog} className="h-10 flex-none rounded-xl border border-line bg-white px-4 text-sm font-bold text-t2 hover:bg-bg">진행 기록 초기화</button>
      </div>

      {MIGRATION_GROUPS.map((g) => (
        <div key={g.n} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-center gap-3 border-b border-line2 px-[18px] py-4">
            <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{g.n}</span>
            <div>
              <b className="block text-sm font-extrabold text-t1">{g.title}</b>
              <span className="mt-0.5 block text-xs text-t3">{g.subtitle}</span>
            </div>
          </div>
          <div className="flex flex-col">
            {g.rows.map((row) => {
              const locked = isLocked(row.kind);
              const done = log[row.kind];
              return (
                <div key={row.kind} className="flex flex-wrap items-center gap-2.5 border-b border-line2 px-[18px] py-3.5 last:border-b-0">
                  <div className={`min-w-[200px] flex-1 ${locked ? "opacity-55" : ""}`}>
                    <b className="block text-sm font-bold text-t1">{row.name}</b>
                    <span className="mt-0.5 block text-xs text-t3">{row.desc}</span>
                  </div>
                  {row.dep && <span className={`flex-none rounded-md bg-bg px-2 py-1 text-[11.5px] font-bold text-t4 ${locked ? "opacity-55" : ""}`}>{row.dep}</span>}
                  <span className={`min-w-[120px] text-right text-xs font-bold tabular-nums ${done ? "text-brand" : "text-t4"} ${locked && !done ? "opacity-55" : ""}`}>
                    {done ? `${done.n}건 · ${done.at}` : "미실행"}
                  </span>
                  <button type="button" onClick={() => downloadCsv(row.schema.file, buildTemplateRows(row.schema))} className="h-[34px] flex-none rounded-xl border border-line bg-white px-3 text-xs font-bold text-t2 hover:bg-bg">양식</button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setActive({ kind: row.kind, schema: row.schema })}
                    className="h-[34px] flex-none rounded-xl bg-brand px-3 text-xs font-bold text-white shadow-pri hover:bg-brand-dark disabled:cursor-default disabled:opacity-40"
                  >업로드</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <BulkImportModal
        open={active !== null}
        schema={active?.schema ?? null}
        onClose={() => setActive(null)}
        onImported={onImported}
      />
    </div>
  );
}
