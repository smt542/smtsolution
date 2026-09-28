import type { ReactNode } from "react";
import { Button } from "@/components/common/Button";
import { CustomDropdown, type DropdownOption } from "@/components/common/CustomDropdown";
import { BUILDING_GROUP_TYPES } from "@/lib/buildings/groupType";
import { ReportDateField } from "../report-controls/ReportDateField";

// 정본 .auto-bar.ac-bar의 필터 라벨·간격을 공용 컨트롤로 구성한다.
function FilterLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={"text-[12px] font-bold text-t3 " + className}>{children}</span>;
}

const groupOptions: DropdownOption[] = [
  { value: "", label: "전체" },
  ...BUILDING_GROUP_TYPES.map((value) => ({ value, label: value })),
];

export interface MonthlyChargeToolbarProps {
  buildingTypeValue: string;
  buildingTypeOptions: DropdownOption[];
  groupValue: string;
  startMonth: string;
  endMonth: string;
  paymentStart: string;
  paymentEnd: string;
  onBuildingType: (value: string) => void;
  onGroup: (value: string) => void;
  onStartMonth: (value: string) => void;
  onEndMonth: (value: string) => void;
  onPaymentStart: (value: string) => void;
  onPaymentEnd: (value: string) => void;
  onSearch: () => void;
}

export function MonthlyChargeToolbar({
  buildingTypeValue,
  buildingTypeOptions,
  groupValue,
  startMonth,
  endMonth,
  paymentStart,
  paymentEnd,
  onBuildingType,
  onGroup,
  onStartMonth,
  onEndMonth,
  onPaymentStart,
  onPaymentEnd,
  onSearch,
}: MonthlyChargeToolbarProps) {
  return (
    <div className="flex w-full shrink-0 flex-wrap items-center gap-[8px] border-b border-line bg-surface px-[16px] py-[13px]">
      <FilterLabel>건물 유형</FilterLabel>
      <CustomDropdown
        ariaLabel="건물 유형"
        value={buildingTypeValue}
        options={buildingTypeOptions}
        onChange={onBuildingType}
        disabled={buildingTypeOptions.length === 0}
        placeholder="-"
        size="compact"
        position="fixed"
        menuMinWidth={120}
      />
      <FilterLabel className="ml-[6px]">그룹</FilterLabel>
      <CustomDropdown
        ariaLabel="그룹"
        value={groupValue}
        options={groupOptions}
        onChange={onGroup}
        size="compact"
        position="fixed"
        menuMinWidth={96}
      />
      <FilterLabel className="ml-[6px]">기준월</FilterLabel>
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
      <FilterLabel className="ml-[6px]">수납일</FilterLabel>
      <ReportDateField
        type="date"
        ariaLabel="수납일 시작"
        placeholder="시작일"
        value={paymentStart}
        max={paymentEnd || undefined}
        onValueChange={onPaymentStart}
      />
      <FilterLabel>~</FilterLabel>
      <ReportDateField
        type="date"
        ariaLabel="수납일 종료"
        placeholder="종료일"
        value={paymentEnd}
        min={paymentStart || undefined}
        onValueChange={onPaymentEnd}
      />
      <div className="min-w-px flex-1" />
      <Button type="button" size="md" onClick={onSearch} className="shadow-none">
        검색
      </Button>
    </div>
  );
}
