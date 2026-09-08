"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CloseIcon } from "@/components/icons";
import { useBillingPeriod, useSaveBillingPeriod } from "@/hooks/reactquery/utilities";
import { defaultBillingDates } from "./BillingPeriodBar";

interface UtilityWorkspaceBarProps {
  buildingId: number;
  buildingName: string;
  period: string;
  utilityLabel: string;
  editing: boolean;
  canEdit: boolean;
  saving: boolean;
  onEditingChange: (editing: boolean) => void;
  onCalculate: () => void;
  onSave: () => void;
}

function displayDate(value: string): string {
  return value.replaceAll("-", ".");
}

export function UtilityWorkspaceBar({
  buildingId,
  buildingName,
  period,
  utilityLabel,
  editing,
  canEdit,
  saving,
  onEditingChange,
  onCalculate,
  onSave,
}: UtilityWorkspaceBarProps) {
  const periodQuery = useBillingPeriod(buildingId, period);
  const savePeriod = useSaveBillingPeriod();
  const defaults = useMemo(() => defaultBillingDates(period), [period]);
  const [startDraft, setStartDraft] = useState<string | null>(null);
  const [endDraft, setEndDraft] = useState<string | null>(null);
  const chargeStartDate = startDraft ?? periodQuery.data?.chargeStartDate ?? defaults.chargeStartDate;
  const chargeEndDate = endDraft ?? periodQuery.data?.chargeEndDate ?? defaults.chargeEndDate;

  const [year, month] = period.split("-").map(Number);
  const save = () => {
    if (!chargeStartDate || !chargeEndDate || chargeStartDate > chargeEndDate) {
      toast.error("부과 시작일과 종료일을 확인해 주세요.");
      return;
    }
    savePeriod.mutate(
      { buildingId, period, chargeStartDate, chargeEndDate },
      {
        onSuccess: () => onSave(),
        onError: () => toast.error("부과기준일 저장에 실패했습니다."),
      },
    );
  };

  return (
    <section className={`flex min-h-[52px] shrink-0 flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-2 ${editing ? "border-teal" : "border-line"}`}>
      <div className="mr-auto min-w-[220px]">
        <h2 className="truncate text-[12.5px] font-extrabold text-t1">{buildingName}</h2>
        <p className="mt-0.5 text-[11px] text-t3">{year}년 {month}월분 {utilityLabel} 부과 편집</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] font-semibold text-t2">부과기준일</span>
        {editing ? (
          <>
            <input aria-label="부과 시작일" type="date" value={chargeStartDate} onChange={(event) => setStartDraft(event.target.value)} className="h-7 w-[128px] rounded-md border border-line bg-white px-2 text-[11px] text-t1 outline-none focus:border-teal" />
            <span className="text-[11px] text-t3">~</span>
            <input aria-label="부과 종료일" type="date" value={chargeEndDate} onChange={(event) => setEndDraft(event.target.value)} className="h-7 w-[128px] rounded-md border border-line bg-white px-2 text-[11px] text-t1 outline-none focus:border-teal" />
          </>
        ) : (
          <>
            <span className="flex h-7 min-w-[106px] items-center justify-center rounded-md bg-bg px-2 text-[11px] font-semibold text-t2">{displayDate(periodQuery.data?.chargeStartDate ?? defaults.chargeStartDate)}</span>
            <span className="text-[11px] text-t3">~</span>
            <span className="flex h-7 min-w-[106px] items-center justify-center rounded-md bg-bg px-2 text-[11px] font-semibold text-t2">{displayDate(periodQuery.data?.chargeEndDate ?? defaults.chargeEndDate)}</span>
          </>
        )}
      </div>

      <span className="hidden h-5 w-px bg-line lg:block" />
      {editing ? (
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onCalculate} className="h-[28px] rounded-md border border-line bg-white px-3 text-[11px] font-bold text-t2 hover:bg-bg">계산</button>
          <button type="button" onClick={save} disabled={saving || savePeriod.isPending} className="h-[28px] rounded-md bg-teal px-3 text-[11px] font-bold text-white hover:bg-brand-dark disabled:opacity-60">저장</button>
          <button type="button" aria-label="수정 취소" onClick={() => onEditingChange(false)} className="grid size-[28px] place-items-center rounded-md border border-line text-t3 hover:bg-bg"><CloseIcon className="size-3.5" /></button>
        </div>
      ) : canEdit ? (
        <button type="button" onClick={() => onEditingChange(true)} className="h-[28px] rounded-md border border-line bg-white px-3 text-[11px] font-bold text-t2 hover:bg-bg">수정</button>
      ) : (
        <span className="text-[11px] text-t3">편집 권한 없음</span>
      )}
    </section>
  );
}
