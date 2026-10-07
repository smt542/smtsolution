"use client";
import { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useConfirm } from "@/components/common/ConfirmProvider";
import {
  useMigrationRuns,
  useResetMigrationRuns,
  type MigrationKind,
  type MigrationRun,
} from "@/hooks/reactquery/dataMigration";
import { useVendorCategories } from "@/hooks/reactquery/vendorCategories";
import { MIGRATION_GROUPS, DEP, resolveSchema, type EntitySchema } from "./dataMigration/schemas";
import { downloadTemplateXlsx } from "./dataMigration/xlsx";
import { BulkImportModal } from "./BulkImportModal";
import { Button } from "@/components/common";

function dotDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function DataMigrationTab() {
  const [active, setActive] = useState<{ kind: MigrationKind; schema: EntitySchema } | null>(null);
  const confirm = useConfirm();
  const { data: runs = [] } = useMigrationRuns();
  const resetRuns = useResetMigrationRuns();
  // 구분(업체 구분) 열은 협력업체 관리의 분류 목록만 고를 수 있게 양식·검증에 반영한다.
  const { data: vendorCategories = [] } = useVendorCategories();
  const categoryLabels = [...vendorCategories]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((category) => category.label);
  const schemaFor = (schema: EntitySchema) => resolveSchema(schema, categoryLabels);

  // 진행 기록은 서버(data_migration_runs)에 남는다. 1건 이상 등록된 실행이 있어야 「완료」로 본다.
  const done = new Map<string, MigrationRun>(
    runs.filter((run) => run.okCount > 0).map((run) => [run.kind, run]),
  );
  const isLocked = (kind: string) => (DEP[kind] ?? []).some((d) => !done.has(d));

  const resetLog = async () => {
    const ok = await confirm({
      title: "진행 기록을 초기화할까요?",
      description: "각 대상의 완료 표시만 지워져요. 이미 등록된 데이터는 삭제되지 않습니다.",
      confirmLabel: "초기화",
      variant: "danger",
    });
    if (!ok) return;
    resetRuns.mutate(undefined, {
      onSuccess: () => toast.success("진행 기록을 초기화했어요"),
      onError: () => toast.error("진행 기록을 초기화하지 못했어요"),
    });
  };

  return (
    <div className="flex w-full flex-col gap-[16px]">
      <div className="flex items-start gap-[12px]">
        <div className="min-w-0">
          <div className="text-[16px] font-extrabold tracking-[-0.32px] text-t1">데이터 이관</div>
          <div className="h-[26px] pt-[5px] text-[13px] font-medium leading-[20.15px] text-t3">기존 서비스의 데이터를 엑셀로 옮겨요. 아래 순서대로 진행해야 참조가 어긋나지 않습니다.</div>
        </div>
        <div className="flex-1" />
        <Button variant="ghost" type="button" onClick={() => void resetLog()} disabled={resetRuns.isPending} className="flex-none">진행 기록 초기화</Button>
      </div>

      {MIGRATION_GROUPS.map((g) => (
        <div key={g.n} className="overflow-clip rounded-[16px] border border-[#dce1e7] bg-white">
          <div className="flex items-center gap-[11px] border-b border-line2 px-[18px] py-[15px]">
            <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[11px] bg-brand text-[12px] font-bold leading-[12px] text-white">{g.n}</span>
            <div>
              <b className="block text-[14px] font-extrabold tracking-[-0.14px] text-t1">{g.title}</b>
              <span className="block h-[18px] pt-[3px] text-[12.5px] font-medium leading-[15px] text-t3">{g.subtitle}</span>
            </div>
          </div>
          <div className="flex flex-col">
            {g.rows.map((row) => {
              const locked = isLocked(row.kind);
              const run = done.get(row.kind);
              return (
                <div key={row.kind} className="flex items-center gap-[10px] border-b border-line2 px-[18px] py-[14px] last:border-b-0">
                  <div className={`min-w-[200px] flex-1 ${locked ? "opacity-55" : ""}`}>
                    <b className="block text-[14px] font-bold tracking-[-0.14px] text-t1">{row.name}</b>
                    <span className="block h-[18px] pt-[3px] text-[12.5px] font-medium leading-[15px] text-t3">{row.desc}</span>
                  </div>
                  {row.dep && <span className={`flex-none rounded-[7px] bg-bg px-[8px] py-[4px] text-[11.5px] font-bold text-t4 ${locked ? "opacity-55" : ""}`}>{row.dep}</span>}
                  <span className={`min-w-[120px] text-right text-[12.5px] font-bold tabular-nums ${run ? "text-brand" : "text-t4"} ${locked && !run ? "opacity-55" : ""}`}>
                    {run ? `${run.okCount}건 · ${dotDate(run.createdAt)}` : "미실행"}
                  </span>
                  {/* 줄높이는 정본 .hf-btn 처럼 normal — 기본 1.5면 글자가 0.87px 위로 뜬다. */}
                  <button type="button" onClick={() => void downloadTemplateXlsx(schemaFor(row.schema))} className="h-[34px] flex-none rounded-[11px] border border-line bg-white px-[13px] text-[12.5px] font-bold leading-[normal] text-t2 hover:bg-bg">양식</button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => setActive({ kind: row.kind as MigrationKind, schema: schemaFor(row.schema) })}
                    className="h-[34px] flex-none rounded-[11px] border border-transparent bg-brand px-[13px] text-[12.5px] font-bold leading-[normal] text-white shadow-pri hover:bg-brand-dark disabled:cursor-default disabled:opacity-40"
                  >업로드</button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <BulkImportModal
        open={active !== null}
        kind={active?.kind ?? null}
        schema={active?.schema ?? null}
        onClose={() => setActive(null)}
      />
    </div>
  );
}
