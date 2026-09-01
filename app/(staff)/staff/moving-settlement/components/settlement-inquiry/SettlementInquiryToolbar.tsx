import { CustomDropdown } from "@/components/common";
import { PrinterIcon, SearchIcon } from "@/components/icons";
import type {
  SettlementInquirySort,
  SettlementInquiryStatus,
} from "@/hooks/reactquery/movingSettlement";

interface SettlementInquiryToolbarProps {
  fromMonth: string;
  toMonth: string;
  status: "" | SettlementInquiryStatus;
  sort: SettlementInquirySort;
  search: string;
  changedCount: number;
  saving: boolean;
  onFromMonthChange: (value: string) => void;
  onToMonthChange: (value: string) => void;
  onStatusChange: (value: "" | SettlementInquiryStatus) => void;
  onSortChange: (value: SettlementInquirySort) => void;
  onSearchChange: (value: string) => void;
  onPrint: () => void;
  onSave: () => void;
}

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, index) => currentYear - 5 + index).map((year) => ({
  value: String(year),
  label: `${year}년`,
}));
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label: `${String(index + 1).padStart(2, "0")}월`,
}));

export function SettlementInquiryToolbar({
  fromMonth,
  toMonth,
  status,
  sort,
  search,
  changedCount,
  saving,
  onFromMonthChange,
  onToMonthChange,
  onStatusChange,
  onSortChange,
  onSearchChange,
  onPrint,
  onSave,
}: SettlementInquiryToolbarProps) {
  const [fromYear, fromValue] = fromMonth.split("-");
  const [toYear, toValue] = toMonth.split("-");

  return (
    <div className="flex h-[65px] min-w-[1160px] items-center gap-[8px] border-b border-line2 bg-white px-[16px] py-[13px]">
      <span className="shrink-0 text-[12px] font-bold text-t3">조회일</span>
      <CustomDropdown
        compact
        ariaLabel="조회 시작 연도"
        value={fromYear}
        options={YEAR_OPTIONS}
        onChange={(value) => onFromMonthChange(`${value}-${fromValue}`)}
      />
      <CustomDropdown
        compact
        ariaLabel="조회 시작 월"
        value={fromValue}
        options={MONTH_OPTIONS}
        onChange={(value) => onFromMonthChange(`${fromYear}-${value}`)}
      />
      <span className="shrink-0 text-[12px] font-bold text-t3">~</span>
      <CustomDropdown
        compact
        ariaLabel="조회 종료 연도"
        value={toYear}
        options={YEAR_OPTIONS}
        onChange={(value) => onToMonthChange(`${value}-${toValue}`)}
      />
      <CustomDropdown
        compact
        ariaLabel="조회 종료 월"
        value={toValue}
        options={MONTH_OPTIONS}
        onChange={(value) => onToMonthChange(`${toYear}-${value}`)}
      />

      <span className="mx-[2px] h-[22px] w-px shrink-0 bg-line" aria-hidden="true" />

      <div className="flex shrink-0 items-start gap-[2px] rounded-[9px] bg-[#EDF0F3] p-[3px]" role="group" aria-label="정산 상태">
        {([
          ["", "전체"],
          ["completed", "완결"],
          ["unresolved", "미결"],
        ] as const).map(([value, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={status === value}
            onClick={() => onStatusChange(value)}
            className={`h-[24px] rounded-[7px] px-[11px] text-[12px] font-bold ${
              status === value ? "bg-white text-t1 shadow-[0_1px_2px_rgba(23,31,40,.08)]" : "text-t3"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-start gap-[2px] rounded-[9px] bg-[#EDF0F3] p-[3px]" role="group" aria-label="정렬">
        {([
          ["code", "코드순"],
          ["date", "일자순"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={sort === value}
            onClick={() => onSortChange(value)}
            className={`h-[24px] rounded-[7px] px-[11px] text-[12px] font-bold ${
              sort === value ? "bg-white text-t1 shadow-[0_1px_2px_rgba(23,31,40,.08)]" : "text-t3"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-w-[18px] flex-1" />

      <label className="relative h-[38px] w-[200px] shrink-0">
        <SearchIcon className="pointer-events-none absolute left-[11px] top-[11.5px] z-10 size-[15px] text-t3" />
        <input
          type="search"
          aria-label="건물명·소재지 검색"
          value={search}
          placeholder="건물명·소재지 검색"
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-[38px] w-full rounded-[10px] border border-line bg-white pl-[32px] pr-[11px] text-[13px] font-semibold text-t1 outline-none placeholder:text-[#757575] focus:border-blue"
        />
      </label>

      <span className="mx-[2px] h-[22px] w-px shrink-0 bg-line" aria-hidden="true" />

      <button
        type="button"
        onClick={onPrint}
        className="flex h-[34px] shrink-0 items-center gap-[6px] rounded-[8px] border border-line bg-white px-[14px] text-[13px] font-bold text-t2 hover:bg-bg"
      >
        <PrinterIcon className="size-[15px]" />
        출력
      </button>
      <button
        type="button"
        disabled={changedCount === 0 || saving}
        onClick={onSave}
        className="h-[34px] shrink-0 rounded-[8px] border border-teal bg-teal px-[16px] text-[13px] font-bold text-white hover:bg-teal-d disabled:border-line disabled:bg-line2 disabled:text-t4"
      >
        {saving ? "저장 중" : "저장"}
      </button>
    </div>
  );
}
