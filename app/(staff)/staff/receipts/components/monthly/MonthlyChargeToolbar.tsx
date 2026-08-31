import { ChevronDownIcon } from "@/components/icons";
import { ReportDateField } from "../report-controls/ReportDateField";

// 필터/툴바 (시안 픽셀 재현 + 실필터 배선).
// 건물유형/그룹 = 현재 선택 컨텍스트 표시(정적), 기준월/수납일 = 실제 입력, 검색 = 재조회.

function FilterLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[12px] font-bold text-t3 ${className}`}>{children}</span>;
}

function SelectButton({ value }: { value: string }) {
  return (
    <span className="flex h-[32px] items-center gap-[7px] rounded-[9px] border border-line bg-surface pl-[11px] pr-[10px] text-[13px] font-bold tracking-[-0.13px] text-t1">
      <span>{value}</span>
      <ChevronDownIcon className="h-[14px] w-[14px] text-t3" />
    </span>
  );
}

export interface MonthlyChargeToolbarProps {
  buildingTypeLabel: string;
  groupLabel: string;
  startMonth: string;
  endMonth: string;
  paymentStart: string;
  paymentEnd: string;
  onStartMonth: (value: string) => void;
  onEndMonth: (value: string) => void;
  onPaymentStart: (value: string) => void;
  onPaymentEnd: (value: string) => void;
  onSearch: () => void;
}

export function MonthlyChargeToolbar({
  buildingTypeLabel,
  groupLabel,
  startMonth,
  endMonth,
  paymentStart,
  paymentEnd,
  onStartMonth,
  onEndMonth,
  onPaymentStart,
  onPaymentEnd,
  onSearch,
}: MonthlyChargeToolbarProps) {
  return (
    <div className="flex w-full shrink-0 flex-wrap items-center gap-[8px] border-b border-line bg-surface px-[16px] py-[13px]">
      <FilterLabel>건물 유형</FilterLabel>
      <SelectButton value={buildingTypeLabel} />
      <FilterLabel className="pl-[6px]">그룹</FilterLabel>
      <SelectButton value={groupLabel} />
      <FilterLabel className="pl-[6px]">기준월</FilterLabel>
      <ReportDateField
        type="month"
        ariaLabel="기준월 시작"
        value={startMonth}
        max={endMonth}
        onValueChange={onStartMonth}
      />
      <FilterLabel>~</FilterLabel>
      <ReportDateField
        type="month"
        ariaLabel="기준월 종료"
        value={endMonth}
        min={startMonth}
        onValueChange={onEndMonth}
      />
      <FilterLabel className="pl-[6px]">수납일</FilterLabel>
      <ReportDateField
        type="date"
        ariaLabel="수납일 시작"
        placeholder="시작일"
        value={paymentStart}
        onValueChange={onPaymentStart}
      />
      <FilterLabel>~</FilterLabel>
      <ReportDateField
        type="date"
        ariaLabel="수납일 종료"
        placeholder="종료일"
        value={paymentEnd}
        onValueChange={onPaymentEnd}
      />
      <div className="min-w-px flex-1" />
      <button
        type="button"
        onClick={onSearch}
        className="flex h-[38px] items-center rounded-[11px] bg-teal px-[15px] text-[13.5px] font-bold text-white hover:bg-teal-d"
      >
        검색
      </button>
    </div>
  );
}
