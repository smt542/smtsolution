"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CloseIcon } from "@/components/icons";
import { useBillingPeriod, useSaveBillingPeriod } from "@/hooks/reactquery/utilities";
import { defaultBillingDates } from "./BillingPeriodBar";
import { isPrototypeFuturePeriod } from "./BillingBasisRequiredState";

interface UtilityWorkspaceBarProps {
  buildingId: number;
  buildingName: string;
  period: string;
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
  const useDefaultBasis = !isPrototypeFuturePeriod(period);
  const chargeStartDate = startDraft
    ?? periodQuery.data?.chargeStartDate
    ?? (useDefaultBasis ? defaults.chargeStartDate : "");
  const chargeEndDate = endDraft
    ?? periodQuery.data?.chargeEndDate
    ?? (useDefaultBasis ? defaults.chargeEndDate : "");

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

  const cancel = () => {
    setStartDraft(null);
    setEndDraft(null);
    onEditingChange(false);
  };

  return (
    <section className={`sticky top-0 z-[4] flex min-h-[52px] shrink-0 flex-wrap items-center gap-2.5 rounded-[12px] border bg-white px-[14px] py-[10px] shadow-[0_1px_3px_rgba(23,31,40,0.05)] ${editing ? "border-blue shadow-[0_0_0_3px_#E2F5F1]" : "border-line"}`}>
      <div className="mr-auto min-w-[220px]">
        <h2 className="truncate text-[12.5px] font-bold text-t1">{buildingName}</h2>
        <p className="mt-px text-[11.5px] font-medium text-t3">{year}년 {month}월분 부과 편집</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11.5px] font-bold text-t2">부과기준일</span>
        {editing ? (
          <>
            <input aria-label="부과 시작일" type="date" value={chargeStartDate} onChange={(event) => setStartDraft(event.target.value)} className="h-7 w-[128px] rounded-[8px] border border-line bg-white px-2 text-[12px] text-t1 outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-t" />
            <span className="text-[12px] font-bold text-t2">~</span>
            <input aria-label="부과 종료일" type="date" value={chargeEndDate} onChange={(event) => setEndDraft(event.target.value)} className="h-7 w-[128px] rounded-[8px] border border-line bg-white px-2 text-[12px] text-t1 outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-t" />
          </>
        ) : (
          <>
            <span className={`flex h-7 min-w-[106px] items-center justify-center rounded-[8px] border border-line2 bg-bg px-2 text-[12px] font-medium ${chargeStartDate ? "text-t1" : "text-t4"}`}>{chargeStartDate ? displayDate(chargeStartDate) : "시작일"}</span>
            <span className="text-[12px] font-bold text-t2">~</span>
            <span className={`flex h-7 min-w-[106px] items-center justify-center rounded-[8px] border border-line2 bg-bg px-2 text-[12px] font-medium ${chargeEndDate ? "text-t1" : "text-t4"}`}>{chargeEndDate ? displayDate(chargeEndDate) : "종료일"}</span>
          </>
        )}
      </div>

      <span className="mx-1 hidden h-[26px] w-px bg-line lg:block" />
      {editing ? (
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onCalculate} className="h-[26px] rounded-[8px] border border-line bg-white px-[10px] text-[11.5px] font-bold text-t2 hover:bg-bg">계산</button>
          <button type="button" onClick={save} disabled={saving || savePeriod.isPending} className="h-[26px] rounded-[8px] bg-blue px-[10px] text-[11.5px] font-bold text-white hover:bg-blue-d disabled:opacity-60">저장</button>
          <button type="button" aria-label="수정 취소" onClick={cancel} className="grid size-[26px] place-items-center rounded-[8px] border border-line text-t3 hover:bg-bg"><CloseIcon className="size-3.5" /></button>
        </div>
      ) : canEdit ? (
        <button type="button" onClick={() => onEditingChange(true)} className="h-[26px] rounded-[8px] border border-line bg-white px-[10px] text-[11.5px] font-bold text-t2 hover:bg-bg">수정</button>
      ) : (
        <span className="text-[11px] text-t3">편집 권한 없음</span>
      )}
    </section>
  );
}
