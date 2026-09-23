"use client";

import { useEffect } from "react";
import Image from "next/image";

export type ManagementFeeDialogKind =
  | "no-building"
  | "carry-all-done"
  | "utility-missing"
  | "zero-amount"
  | "carry-all"
  | "carry-building"
  | "important-building";

interface ManagementFeeDialogProps {
  kind: ManagementFeeDialogKind | null;
  buildingName: string;
  period: string;
  pending?: boolean;
  zeroAmountUnitCount?: number;
  zeroAmountItemCount?: number;
  /** carry-all-done: 전월 자료가 있어 반영된 건물 수 */
  carriedBuildingCount?: number;
  onClose: () => void;
  onConfirm: () => void;
}

function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return `${year}년 ${month}월분`;
}

function previousPeriodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월분`;
}

export function ManagementFeeDialog({
  kind,
  buildingName,
  period,
  pending = false,
  zeroAmountUnitCount = 0,
  zeroAmountItemCount = 0,
  carriedBuildingCount = 0,
  onClose,
  onConfirm,
}: ManagementFeeDialogProps) {
  useEffect(() => {
    if (!kind) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [kind, onClose, pending]);

  if (!kind) return null;

  const current = periodLabel(period);
  const previous = previousPeriodLabel(period);
  const noBuilding = kind === "no-building";
  const carryAllDone = kind === "carry-all-done";
  const utilityMissing = kind === "utility-missing";
  // 원본 mfAsk: tone 미지정(info)은 청록 i 아이콘 + 확인 버튼 하나.
  const infoTone = noBuilding || carryAllDone;
  const confirmLabel =
    infoTone || utilityMissing || kind === "important-building"
      ? "확인"
      : kind === "zero-amount"
        ? "계속 확정"
        : "반영";
  const title = {
    "no-building": "건물을 먼저 선택해 주세요",
    "carry-all-done": carriedBuildingCount > 0 ? "전월 자료를 반영했어요" : "반영할 자료가 없어요",
    "utility-missing": "공과금 부과액이 아직 없어요",
    "zero-amount": "0원 부과 항목이 있어요",
    "carry-all": "전체 건물에 전월 자료를 반영할까요?",
    "carry-building": "이 건물에 전월 자료를 반영할까요?",
    "important-building": "중요 건물로 지정된 건물이에요",
  }[kind];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim px-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="management-fee-dialog-title"
        className={`w-full overflow-hidden rounded-[20px] bg-white px-[26px] pb-[24px] pt-[28px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)] ${
          utilityMissing ? "max-w-[400px]" : "max-w-[420px]"
        }`}
      >
        <div className="flex items-center gap-[9px]">
          <span
            className={`flex size-[34px] shrink-0 items-center justify-center rounded-[11px] ${
              utilityMissing ? "bg-red-t" : infoTone ? "bg-teal-t text-teal" : "bg-amber-t"
            }`}
          >
            {infoTone ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-[19px]" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
            ) : (
              <Image
                src={utilityMissing ? "/icons/management-fee-error.svg" : "/icons/management-fee-warning.svg"}
                alt=""
                width={19}
                height={19}
                className="size-[19px]"
              />
            )}
          </span>
          <h2 id="management-fee-dialog-title" className="text-[16px] font-extrabold text-t1">
            {title}
          </h2>
        </div>

        {/* 원본 mfAsk 본문엔 최소 높이가 없다 — utility-missing(원본 대응 없음)만 기존 높이 유지 */}
        <div className={`${utilityMissing ? "min-h-[56px] " : ""}pt-[12px] text-[13.5px] font-medium leading-[22px] text-t2`}>
          {noBuilding && <p>좌측 건물 목록에서 대상 건물을 선택한 뒤 다시 시도해 주세요.</p>}
          {carryAllDone && (
            <p>
              {carriedBuildingCount > 0
                ? `${carriedBuildingCount}개 건물의 ${current}에 전월 자료를 반영했습니다.`
                : `${previous}에 저장된 자료가 없습니다.`}
            </p>
          )}
          {kind === "utility-missing" && (
            <>
              <p>
                {current} <strong className="font-bold text-red">수도 · 전기 · 가스</strong> 부과액이 산정되지 않았습니다.
              </p>
              <p>공과금 관리에서 먼저 부과액을 입력해 주세요.</p>
            </>
          )}
          {kind === "zero-amount" && (
            <>
              <p>
                <strong className="font-bold text-amber">{zeroAmountUnitCount}개 세대</strong>에서{" "}
                <strong className="font-bold text-amber">{zeroAmountItemCount}개 항목</strong>이 0원으로 부과됩니다.
                계속하시겠습니까?
              </p>
              <p className="mt-[4px] text-[12px] leading-[19px] text-t3">
                의도적으로 0원을 입력한 항목도 포함될 수 있으니 부과 금액을 확인해 주세요.
              </p>
            </>
          )}
          {kind === "carry-all" && (
            <>
              <p>
                {previous} 자료를 모든 건물의 <strong className="font-bold text-t1">{current}</strong>에 반영합니다.
              </p>
              <p>기존에 입력한 값은 덮어써요.</p>
            </>
          )}
          {kind === "carry-building" && (
            <>
              <p>
                <strong className="font-bold text-t1">{buildingName}</strong>의 {previous} 자료를{" "}
                <strong className="font-bold text-t1">{current}</strong>에 반영합니다.
              </p>
              <p>기존에 입력한 값은 덮어써요.</p>
            </>
          )}
          {kind === "important-building" && (
            <>
              <p>{buildingName} · 전월 자료를 그대로 반영하기 전에</p>
              <p>항목과 금액을 반드시 확인해 주세요.</p>
            </>
          )}
        </div>

        <div className={`flex gap-[8px] pt-[20px] ${utilityMissing ? "" : "justify-end"}`}>
          {!utilityMissing && !infoTone && (
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="h-[40px] flex-1 rounded-[11px] border border-line bg-white px-[18px] text-[13.5px] font-bold text-t2 disabled:opacity-60"
            >
              취소
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="h-[40px] flex-1 rounded-[11px] border border-teal bg-teal px-[18px] text-[13.5px] font-bold text-white disabled:opacity-60"
          >
            {pending ? `${confirmLabel} 중…` : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
