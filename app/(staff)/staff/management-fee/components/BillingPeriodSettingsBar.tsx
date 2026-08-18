"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/common";
import {
  defaultBillingPeriodSetting,
  useBillingPeriodSetting,
  useSaveBillingPeriodSetting,
  type SaveBillingPeriodSettingPayload,
} from "@/hooks/reactquery/billing";

type ScheduleDraft = Pick<
  SaveBillingPeriodSettingPayload,
  "chargeStartDate" | "chargeEndDate" | "dueDate"
>;

interface BillingPeriodSettingsBarProps {
  buildingId: number;
  period: string;
}

const inputClassName = "h-9 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-t1 focus:border-blue focus:outline-none disabled:bg-bg disabled:text-t3";

export function BillingPeriodSettingsBar({ buildingId, period }: BillingPeriodSettingsBarProps) {
  const settingQuery = useBillingPeriodSetting(buildingId, period);
  const saveSetting = useSaveBillingPeriodSetting();
  const [draft, setDraft] = useState<ScheduleDraft | null>(null);

  const setting = settingQuery.data ?? defaultBillingPeriodSetting(buildingId, period);
  const values = draft ?? setting;
  const isEditing = draft !== null;

  const startEditing = () => {
    setDraft({
      chargeStartDate: setting.chargeStartDate,
      chargeEndDate: setting.chargeEndDate,
      dueDate: setting.dueDate,
    });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.chargeStartDate || !draft.chargeEndDate) {
      toast.error("부과기준일 시작일과 종료일을 입력해 주세요.");
      return;
    }
    if (draft.chargeStartDate > draft.chargeEndDate) {
      toast.error("부과기준일 종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }
    try {
      await saveSetting.mutateAsync({ buildingId, period, ...draft });
      setDraft(null);
      toast.success("부과 일정이 저장되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div
      role="group"
      aria-label="부과 일정 설정"
      className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4"
    >
      <div className="mr-1 min-w-28 self-center">
        <p className="text-xs font-extrabold text-t1">부과 일정</p>
        <p className="mt-0.5 text-[11px] text-t3">
          {settingQuery.isLoading ? "불러오는 중" : setting.isSaved ? "저장된 설정" : "기본값 적용 중"}
        </p>
      </div>
      <div>
        <span className="mb-1.5 block text-xs font-bold text-t2">부과기준일</span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="부과기준일 시작일"
            value={values.chargeStartDate}
            disabled={!isEditing || saveSetting.isPending}
            onChange={(event) => setDraft((current) => current && ({ ...current, chargeStartDate: event.target.value }))}
            className={inputClassName}
          />
          <span className="text-sm font-bold text-t3">~</span>
          <input
            type="date"
            aria-label="부과기준일 종료일"
            value={values.chargeEndDate}
            disabled={!isEditing || saveSetting.isPending}
            onChange={(event) => setDraft((current) => current && ({ ...current, chargeEndDate: event.target.value }))}
            className={inputClassName}
          />
        </div>
      </div>
      <label>
        <span className="mb-1.5 block text-xs font-bold text-t2">납기일</span>
        <input
          type="date"
          aria-label="납기일"
          value={values.dueDate ?? ""}
          disabled={!isEditing || saveSetting.isPending}
          onChange={(event) => setDraft((current) => current && ({ ...current, dueDate: event.target.value || null }))}
          className={inputClassName}
        />
      </label>
      <div className="ml-auto flex gap-2">
        {isEditing ? (
          <>
            <Button type="button" variant="ghost" onClick={() => setDraft(null)} disabled={saveSetting.isPending}>
              취소
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saveSetting.isPending}>
              {saveSetting.isPending ? "저장 중…" : "저장"}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={startEditing}
            disabled={settingQuery.isLoading || settingQuery.isError}
          >
            수정
          </Button>
        )}
      </div>
      {settingQuery.isError && (
        <p className="w-full text-right text-xs font-semibold text-red">부과 일정 설정을 불러오지 못했습니다.</p>
      )}
    </div>
  );
}
