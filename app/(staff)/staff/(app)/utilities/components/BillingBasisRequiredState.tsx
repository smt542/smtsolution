import { isFuturePeriod } from "@/lib/billing/period";

interface BillingBasisRequiredStateProps {
  detailed?: boolean;
  onEdit: () => void;
}

// 부과기준일 게이팅용 미래월 판정. 원본 프로토타입은 2026-07을 하드코딩했으나, 실앱은 현재
// 날짜 기준이어야 하므로 lib/billing/period의 isFuturePeriod(현재월 초과)에 위임한다.
// (이름은 레거시 — 후속에서 isFuturePeriod 직접 사용으로 정리 가능)
export function isPrototypeFuturePeriod(period: string): boolean {
  return isFuturePeriod(period);
}

export function hasBillingBasis(startDate?: string | null, endDate?: string | null): boolean {
  return Boolean(startDate && endDate);
}

export function BillingBasisRequiredState({
  detailed = true,
  onEdit,
}: BillingBasisRequiredStateProps) {
  return (
    <div className="flex min-h-[260px] flex-1 flex-col items-center justify-center gap-1.5 px-6 pb-[52px] pt-11 text-center">
      <div className="mb-1 flex size-14 items-center justify-center rounded-[17px] bg-blue-t text-blue">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-[27px]"
        >
          <rect x="4" y="5" width="16" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M4 11h16" />
        </svg>
      </div>
      <p className="text-[16px] font-bold tracking-[-0.02em] text-t1">부과기준일을 먼저 설정해 주세요</p>
      {detailed && (
        <p className="text-[13.5px] font-normal leading-[1.6] text-t3">
          아직 검침이 등록되지 않은 달이에요<br />
          <strong className="font-bold text-t2">수정</strong>을 눌러 부과기준일을 지정하면<br />
          호실 목록이 표시돼요
        </p>
      )}
      <button
        type="button"
        onClick={onEdit}
        className="mt-4 h-[42px] rounded-[12px] bg-blue px-[22px] text-[14px] font-bold text-white hover:bg-blue-d"
      >
        부과기준일 설정
      </button>
    </div>
  );
}
