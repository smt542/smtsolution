"use client";

import { useEffect, type RefObject } from "react";
import { useManagementFeeRows } from "@/hooks/reactquery/movingSettlement/feeItemCharges";
import type { MovingSettlementValues } from "@/components/forms/schema/movingSettlement";
import type {
  ChecklistItem,
  MeterSummary,
  SettlementSettings,
} from "@/hooks/reactquery/movingSettlement";
import { calculateSettlementAmount } from "@/hooks/reactquery/movingSettlement";
import { ManagementFeeSection } from "./settlement-form/ManagementFeeSection";
import { SettlementBasicSection } from "./settlement-form/SettlementBasicSection";
import { SettlementExtrasSection } from "./settlement-form/SettlementExtrasSection";
import { SettlementSummaryBar } from "./settlement-form/SettlementSummaryBar";
import {
  reflectedUtilityCharges,
  UtilitySettlementSection,
} from "./settlement-form/UtilitySettlementSection";

export type SettlementDraft = MovingSettlementValues;
const EMPTY_INPUT_REF: RefObject<HTMLInputElement | null> = { current: null };
const DEFAULT_SETTINGS: SettlementSettings = {
  waterUnitReflect: false,
  electricUnitReflect: false,
  vacancyPaymentMode: "auto",
};

export function calculateProratedMgmtFee(
  monthly: number | null,
  moveOutDate: string,
): number {
  if (monthly === null || moveOutDate === "") return 0;

  const [year, month, day] = moveOutDate.split("-").map(Number);
  if (!year || !month || !day) return 0;

  return Math.round((monthly * day) / 30);
}

export function SettlementForm({
  buildingName = "선택 세대",
  buildingTypeId = null,
  unitId = null,
  unitNo = "",
  contactPhone = "",
  value,
  onChange,
  meters = [],
  settings = DEFAULT_SETTINGS,
  checklist = [],
  notes = {},
  onChecklistNoteChange = () => undefined,
  receivedAmount = 0,
  onReceivedAmountChange = () => undefined,
  finalPaidDate = "",
  onFinalPaidDateChange = () => undefined,
  paymentInputRef = EMPTY_INPUT_REF,
  bodyRef,
}: {
  buildingName?: string;
  buildingTypeId?: number | null;
  unitId?: number | null;
  unitNo?: string;
  contactPhone?: string;
  value: SettlementDraft;
  onChange: (next: SettlementDraft) => void;
  meters?: MeterSummary[];
  settings?: SettlementSettings;
  checklist?: ChecklistItem[];
  /** 정산 체크 항목별 메모(0172). checked 는 이 값이 비어있지 않은지로 파생된다. */
  notes?: Record<number, string>;
  onChecklistNoteChange?: (id: number, note: string) => void;
  receivedAmount?: number;
  onReceivedAmountChange?: (amount: number) => void;
  finalPaidDate?: string;
  onFinalPaidDateChange?: (date: string) => void;
  paymentInputRef?: RefObject<HTMLInputElement | null>;
  /** 폼 본문 스크롤 영역(정본 #msBody). [수납액 입력]이 이 영역을 수납액 칸까지 부드럽게 올린다. */
  bodyRef?: RefObject<HTMLDivElement | null>;
}) {
  // 관리비 소계는 관리비 항목(fee_items)x당월 부과액에서 계산된다. 섹션 표시값과
  // 하단 요약바/미수금/저장값이 어긋나지 않도록 계산 결과를 draft 에 되돌려 넣어
  // 숫자 출처를 하나로 유지한다. 정본 헤더의 "정산액(일할 자동)" 동작이다.
  const { subtotal: managementTotal } = useManagementFeeRows(
    buildingTypeId,
    unitId,
    value.moveOutDate,
  );
  // 단가 반영 ON 인 공과금 금액도 계산값이다. 관리비 소계와 **한 이펙트에서** 되돌려 넣는다 —
  // 이펙트를 둘로 나누면 각자 stale 한 value 를 펼쳐 서로의 결과를 덮어쓴다.
  const reflectedCharges = reflectedUtilityCharges(meters, settings);
  const derivedKey = JSON.stringify([managementTotal, reflectedCharges]);
  useEffect(() => {
    const patch: Partial<SettlementDraft> = {};
    if ((value.mgmtFeeProrated ?? 0) !== managementTotal) {
      patch.mgmtFeeProrated = managementTotal;
    }
    for (const [key, amount] of Object.entries(reflectedCharges)) {
      const chargeKey = key as "waterCharge" | "elecCharge" | "gasCharge";
      if ((value[chargeKey] ?? null) !== amount) patch[chargeKey] = amount;
    }
    if (Object.keys(patch).length === 0) return;
    onChange({ ...value, ...patch });
    // value/onChange 를 의존성에 넣으면 매 렌더 재실행되므로 계산값만 추적한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedKey]);

  const set = <K extends keyof SettlementDraft>(
    key: K,
    next: SettlementDraft[K],
  ) => onChange({ ...value, [key]: next });
  const amount = calculateSettlementAmount(value);

  const setMoveOutDate = (moveOutDate: string) =>
    onChange({
      ...value,
      moveOutDate,
      mgmtFeeProrated: calculateProratedMgmtFee(
        value.mgmtFeeMonthly,
        moveOutDate,
      ),
    });

  const setMonthly = (mgmtFeeMonthly: number | null) =>
    onChange({
      ...value,
      mgmtFeeMonthly,
      mgmtFeeProrated: calculateProratedMgmtFee(
        mgmtFeeMonthly,
        value.moveOutDate,
      ),
    });

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
      <div className="flex h-[49px] shrink-0 items-center border-b border-line2 px-[18px]">
        <h2 className="text-[15px] font-extrabold leading-[18px] text-t1">
          {buildingName} {unitNo}
        </h2>
      </div>

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-auto px-[18px] pb-[20px] pt-[16px]">
        <div className="flex flex-col gap-[10px]">
          <SettlementBasicSection
            moveOutDate={value.moveOutDate}
            onMoveOutDateChange={setMoveOutDate}
          />
          <UtilitySettlementSection
            value={value}
            meters={meters}
            settings={settings}
            onChange={onChange}
          />
          <ManagementFeeSection
            buildingTypeId={buildingTypeId}
            unitId={unitId}
            moveOutDate={value.moveOutDate}
            monthly={value.mgmtFeeMonthly}
            prorated={value.mgmtFeeProrated}
            contactPhone={contactPhone}
            onMonthlyChange={setMonthly}
            onProratedChange={(next) => set("mgmtFeeProrated", next)}
          />
          <SettlementExtrasSection
            value={value}
            onChange={onChange}
            checklist={checklist}
            notes={notes}
            onChecklistNoteChange={onChecklistNoteChange}
            receivedAmount={receivedAmount}
            onReceivedAmountChange={onReceivedAmountChange}
            finalPaidDate={finalPaidDate}
            onFinalPaidDateChange={onFinalPaidDateChange}
            paymentInputRef={paymentInputRef}
          />
        </div>
      </div>

      <SettlementSummaryBar
        utilityTotal={(value.waterCharge ?? 0) + (value.elecCharge ?? 0) + (value.gasCharge ?? 0)}
        managementTotal={value.mgmtFeeProrated ?? 0}
        otherTotal={value.repairAmount ?? 0}
        receivedAmount={receivedAmount}
        total={amount}
      />
    </section>
  );
}
