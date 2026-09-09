"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CloseIcon } from "@/components/icons";
import {
  defaultBillingPeriodSetting,
  useBillingPeriodSetting,
  useSaveBillingPeriodSetting,
  type SaveBillingPeriodSettingPayload,
} from "@/hooks/reactquery/billing";

type ScheduleDraft = Pick<SaveBillingPeriodSettingPayload, "chargeStartDate" | "chargeEndDate" | "dueDate">;

interface BillingPeriodSettingsBarProps {
  buildingId: number | null;
  buildingName: string;
  period: string;
  editing: boolean;
  pending?: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}

// 원본 .uc-dpx .dp-ctl: 28px·min-w 106px·radius8·12px/500·중앙정렬. 잠금(비수정) 시 bg=var(--bg)·border=var(--line2).
function dpClass(active: boolean) {
  return [
    "h-[28px] w-[106px] rounded-[8px] border px-[10px] text-center text-[12px] font-medium text-t1 outline-none",
    active
      ? "border-line bg-white focus:border-teal focus:shadow-[0_0_0_3px_#E2F5F1]"
      : "pointer-events-none border-line2 bg-bg",
  ].join(" ");
}

function periodLabel(period: string) {
  const [year, month] = period.split("-");
  return year && month ? `${year}년 ${Number(month)}월분` : "";
}

export function BillingPeriodSettingsBar({
  buildingId,
  buildingName,
  period,
  editing,
  pending = false,
  onEdit,
  onCancel,
  onSave,
}: BillingPeriodSettingsBarProps) {
  const settingQuery = useBillingPeriodSetting(buildingId, period);
  const saveSetting = useSaveBillingPeriodSetting();
  const fallback = defaultBillingPeriodSetting(buildingId ?? 0, period);
  const setting = settingQuery.data ?? fallback;
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);
  const values = draft ?? setting;

  const ensureDraft = () => {
    setDraft({
      chargeStartDate: setting.chargeStartDate,
      chargeEndDate: setting.chargeEndDate,
      dueDate: setting.dueDate,
    });
    onEdit();
  };

  const cancel = () => {
    setDraft(null);
    onCancel();
  };

  const save = async () => {
    if (!buildingId) return;
    const next = draft ?? {
      chargeStartDate: setting.chargeStartDate,
      chargeEndDate: setting.chargeEndDate,
      dueDate: setting.dueDate,
    };
    if (!next.chargeStartDate || !next.chargeEndDate) {
      toast.error("부과기준일 시작일과 종료일을 입력해 주세요");
      return;
    }
    if (next.chargeStartDate > next.chargeEndDate) {
      toast.error("부과기준일 종료일은 시작일보다 빠를 수 없어요");
      return;
    }
    try {
      await saveSetting.mutateAsync({ buildingId, period, ...next });
      await onSave();
      setDraft(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const disabled = pending || saveSetting.isPending;
  const active = editing && !!buildingId && !disabled;
  const show = (value: string | null) => (buildingId ? value ?? "" : "");
  return (
    <section
      role="group"
      aria-label="부과 일정 설정"
      className={`sticky top-0 z-[4] flex flex-none items-center gap-[10px] rounded-[12px] border bg-white px-[14px] py-[10px] ${
        editing ? "border-teal shadow-[0_0_0_3px_#E2F5F1]" : "border-line shadow-card"
      }`}
    >
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-bold text-t1">{buildingName || "건물을 선택해 주세요"}</div>
        <div className="whitespace-nowrap text-[11.5px] font-medium text-t3">
          <span>{periodLabel(period)}</span> 부과 세팅
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex flex-none items-center gap-[6px]">
        <span className="whitespace-nowrap text-[11.5px] font-bold text-t2">부과기준일</span>
        <input
          type="date"
          aria-label="부과기준일 시작일"
          value={show(values.chargeStartDate)}
          disabled={!active}
          onChange={(event) => setDraft((current) => ({ ...(current ?? values), chargeStartDate: event.target.value }))}
          className={dpClass(active)}
        />
        <span className="text-[12px] font-bold text-t2">~</span>
        <input
          type="date"
          aria-label="부과기준일 종료일"
          value={show(values.chargeEndDate)}
          disabled={!active}
          onChange={(event) => setDraft((current) => ({ ...(current ?? values), chargeEndDate: event.target.value }))}
          className={dpClass(active)}
        />
        <span className="mx-[4px] h-[26px] w-px flex-none bg-line" />
        <span className="whitespace-nowrap text-[11.5px] font-bold text-t2">납기일</span>
        <input
          type="date"
          aria-label="납기일"
          value={show(values.dueDate)}
          disabled={!active}
          onChange={(event) => setDraft((current) => ({ ...(current ?? values), dueDate: event.target.value }))}
          className={dpClass(active)}
        />
      </div>

      <span className="mx-[4px] h-[26px] w-px flex-none bg-line" />

      <div className="flex flex-none items-center gap-[6px]">
        {editing ? (
          <>
            <button
              type="button"
              disabled={disabled || !buildingId}
              onClick={() => void save()}
              className="h-[26px] rounded-[8px] border border-teal bg-teal px-[10px] text-[11.5px] font-bold text-white hover:bg-teal-d disabled:opacity-50"
            >
              {disabled ? "저장 중…" : "저장"}
            </button>
            <button
              type="button"
              aria-label="수정 닫기"
              title="취소"
              disabled={disabled}
              onClick={cancel}
              className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border border-line bg-white text-t3 hover:text-t2 disabled:opacity-50"
            >
              <CloseIcon className="size-[14px]" />
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!buildingId || settingQuery.isLoading || settingQuery.isError}
            onClick={ensureDraft}
            className="h-[26px] rounded-[8px] border border-line bg-white px-[10px] text-[11.5px] font-bold text-t2 hover:border-[#C9D0D8] hover:bg-[#F7F9FA] disabled:bg-bg disabled:text-t4"
          >
            수정
          </button>
        )}
      </div>
    </section>
  );
}
