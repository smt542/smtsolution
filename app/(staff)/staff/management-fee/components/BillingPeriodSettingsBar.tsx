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

const dateClass = "h-[32px] w-[128px] rounded-[8px] border border-line bg-white px-[9px] text-[12px] font-semibold text-t1 outline-none focus:border-teal disabled:border-transparent disabled:bg-transparent disabled:px-0";

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
      toast.error("부과기준일 시작일과 종료일을 입력해 주세요.");
      return;
    }
    if (next.chargeStartDate > next.chargeEndDate) {
      toast.error("부과기준일 종료일은 시작일보다 빠를 수 없습니다.");
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
  return (
    <section
      role="group"
      aria-label="부과 일정 설정"
      className={`flex h-[51px] items-center rounded-[12px] bg-white px-[14px] shadow-card ${editing ? "border border-teal" : "border border-transparent"}`}
    >
      <p className="mr-[18px] max-w-[260px] truncate text-[13.5px] font-extrabold text-t1">
        {buildingName || "건물을 선택해 주세요"}
      </p>
      <span className="mr-[9px] text-[12px] font-bold text-t3">부과기준일</span>
      <input
        type="date"
        aria-label="부과기준일 시작일"
        value={values.chargeStartDate}
        disabled={!editing || disabled || !buildingId}
        onChange={(event) => setDraft((current) => ({ ...(current ?? values), chargeStartDate: event.target.value }))}
        className={dateClass}
      />
      <span className="mx-[6px] text-[12px] font-bold text-t3">~</span>
      <input
        type="date"
        aria-label="부과기준일 종료일"
        value={values.chargeEndDate}
        disabled={!editing || disabled || !buildingId}
        onChange={(event) => setDraft((current) => ({ ...(current ?? values), chargeEndDate: event.target.value }))}
        className={dateClass}
      />

      <div className="ml-auto flex items-center gap-[7px]">
        {editing ? (
          <>
            <button type="button" disabled={disabled || !buildingId} onClick={() => void save()} className="h-[32px] min-w-[64px] rounded-[9px] bg-teal px-[14px] text-[12px] font-extrabold text-white disabled:opacity-50">
              {disabled ? "저장 중…" : "저장"}
            </button>
            <button type="button" aria-label="수정 닫기" disabled={disabled} onClick={cancel} className="flex size-[32px] items-center justify-center rounded-[9px] border border-line bg-white text-t3 disabled:opacity-50">
              <CloseIcon className="size-[15px]" />
            </button>
          </>
        ) : (
          <button type="button" disabled={!buildingId || settingQuery.isLoading || settingQuery.isError} onClick={ensureDraft} className="h-[32px] min-w-[64px] rounded-[9px] border border-line bg-white px-[14px] text-[12px] font-extrabold text-t2 disabled:bg-bg disabled:text-t4">
            수정
          </button>
        )}
      </div>
    </section>
  );
}
