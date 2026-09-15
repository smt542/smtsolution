import { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Button, Input, Spinner } from "@/components/common";
import {
  useBillingPeriod,
  useSaveBillingPeriod,
} from "@/hooks/reactquery/utilities";

interface BillingPeriodBarProps {
  buildingId: number;
  period: string;
  canEdit: boolean;
}

function isoDate(year: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

export function defaultBillingDates(period: string) {
  const [year, month] = period.split("-").map(Number);
  return {
    chargeStartDate: isoDate(year, month - 2, 16),
    chargeEndDate: isoDate(year, month - 1, 15),
  };
}

export function BillingPeriodBar({
  buildingId,
  period,
  canEdit,
}: BillingPeriodBarProps) {
  const periodQuery = useBillingPeriod(buildingId, period);
  const savePeriod = useSaveBillingPeriod();
  const [editing, setEditing] = useState(false);
  const [chargeStartDate, setChargeStartDate] = useState("");
  const [chargeEndDate, setChargeEndDate] = useState("");
  const setting = periodQuery.data;
  const isBillingPeriodRefreshing = periodQuery.isFetching && !periodQuery.isLoading;

  const startEditing = () => {
    const defaults = defaultBillingDates(period);
    setChargeStartDate(setting?.chargeStartDate ?? defaults.chargeStartDate);
    setChargeEndDate(setting?.chargeEndDate ?? defaults.chargeEndDate);
    setEditing(true);
  };

  const submit = () => {
    if (!chargeStartDate || !chargeEndDate || chargeStartDate > chargeEndDate) {
      toast.error("부과 시작일과 종료일을 확인해 주세요.");
      return;
    }
    savePeriod.mutate(
      { buildingId, period, chargeStartDate, chargeEndDate },
      {
        onSuccess: () => {
          toast.success("부과기준일을 저장했습니다.");
          setEditing(false);
        },
        onError: (error) => {
          toast.error(error, "부과기준일 저장에 실패했습니다.");
        },
      },
    );
  };

  return (
    <section className="relative min-h-[64px] rounded-xl border border-blue/20 bg-blue-t2 px-4 py-3 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <strong className="text-sm text-blue-d">부과기준일</strong>
        {isBillingPeriodRefreshing ? (
          <Spinner label="부과기준일 갱신 중" size="small" showLabel className="px-2 py-1" />
        ) : null}
        {periodQuery.isLoading ? (
          <Spinner label="부과기준일 불러오는 중" size="small" showLabel className="px-2 py-1" />
        ) : periodQuery.error ? (
          <span role="alert" className="text-sm font-semibold text-red">부과기준일을 불러오지 못했습니다.</span>
        ) : editing ? (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Input
              aria-label="부과 시작일"
              type="date"
              value={chargeStartDate}
              onChange={(event) => setChargeStartDate(event.target.value)}
              className="h-9 w-auto"
            />
            <span className="text-sm text-t3">~</span>
            <Input
              aria-label="부과 종료일"
              type="date"
              value={chargeEndDate}
              onChange={(event) => setChargeEndDate(event.target.value)}
              className="h-9 w-auto"
            />
            <Button
              type="button"
              className="h-9 px-3"
              onClick={submit}
              disabled={savePeriod.isPending}
            >
              {savePeriod.isPending ? "저장 중…" : "저장"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-3"
              onClick={() => setEditing(false)}
            >
              취소
            </Button>
          </div>
        ) : (
          <>
            <span className="text-sm font-semibold text-t1">
              {setting
                ? `${setting.chargeStartDate} ~ ${setting.chargeEndDate}`
                : "부과기준일을 먼저 설정해 주세요."}
            </span>
            {setting?.dueDate && (
              <span className="rounded-lg bg-surface px-2.5 py-1 text-xs font-bold text-t2">
                납기일 {setting.dueDate}
              </span>
            )}
            {canEdit ? (
              <Button
                type="button"
                variant="ghost"
                className="ml-auto h-9 px-3"
                onClick={startEditing}
              >
                수정
              </Button>
            ) : (
              <span className="ml-auto text-xs text-t3">
                관리비 부과 세팅에서 설정할 수 있습니다.
              </span>
            )}
          </>
        )}
      </div>
    </section>
  );
}
