import { CustomDropdown } from "@/components/common";
import { PrinterIcon, SearchIcon } from "@/components/icons";
import type {
  SettlementInquirySort,
  SettlementInquiryStatus,
} from "@/hooks/reactquery/movingSettlement";

interface AllSettlementInquiryToolbarProps {
  years: { value: string; label: string }[];
  months: { value: string; label: string }[];
  fromYear: string;
  fromMonth: string;
  toYear: string;
  toMonth: string;
  status: "" | Extract<SettlementInquiryStatus, "completed" | "incomplete">;
  sort: SettlementInquirySort;
  search: string;
  dirty: boolean;
  saving: boolean;
  hasRows: boolean;
  onFromYearChange: (value: string) => void;
  onFromMonthChange: (value: string) => void;
  onToYearChange: (value: string) => void;
  onToMonthChange: (value: string) => void;
  onStatusChange: (
    value: "" | Extract<SettlementInquiryStatus, "completed" | "incomplete">,
  ) => void;
  onSortChange: (value: SettlementInquirySort) => void;
  onSearchChange: (value: string) => void;
  onPrint: () => void;
  onSave: () => void;
}

export function AllSettlementInquiryToolbar({
  years,
  months,
  fromYear,
  fromMonth,
  toYear,
  toMonth,
  status,
  sort,
  search,
  dirty,
  saving,
  hasRows,
  onFromYearChange,
  onFromMonthChange,
  onToYearChange,
  onToMonthChange,
  onStatusChange,
  onSortChange,
  onSearchChange,
  onPrint,
  onSave,
}: AllSettlementInquiryToolbarProps) {
  return (
    <div className="moving-inquiry-toolbar flex min-h-[65px] min-w-[1270px] items-center gap-[8px] rounded-t-[16px] border-b border-line2 bg-white px-[16px] py-[13px]">
      <span className="text-[12px] font-bold text-t3">조회일</span>
      <CustomDropdown
        ariaLabel="조회 시작 연도"
        value={fromYear}
        options={years}
        onChange={onFromYearChange}
        size="compact"
        position="fixed"
      />
      <CustomDropdown
        ariaLabel="조회 시작 월"
        value={fromMonth}
        options={months}
        onChange={onFromMonthChange}
        size="compact"
        position="fixed"
      />
      <span className="text-[12px] font-bold text-t3">~</span>
      <CustomDropdown
        ariaLabel="조회 종료 연도"
        value={toYear}
        options={years}
        onChange={onToYearChange}
        size="compact"
        position="fixed"
      />
      <CustomDropdown
        ariaLabel="조회 종료 월"
        value={toMonth}
        options={months}
        onChange={onToMonthChange}
        size="compact"
        position="fixed"
      />

      <span className="flex items-start px-[2px]" aria-hidden="true">
        <span className="h-[22px] w-px bg-line" />
      </span>

      <div
        aria-label="정산 상태"
        className="flex gap-[2px] rounded-[9px] bg-[#edf0f3] p-[3px]"
      >
        {[
          ["", "전체"],
          ["completed", "완결"],
          ["incomplete", "미결"],
        ].map(([value, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={status === value}
            onClick={() => onStatusChange(value as typeof status)}
            className={`rounded-[7px] px-[11px] py-[5px] text-[12px] leading-[15px] font-bold ${
              status === value ? "bg-white text-t1" : "text-t3 hover:text-t2"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        aria-label="조회 정렬"
        className="flex gap-[2px] rounded-[9px] bg-[#edf0f3] p-[3px]"
      >
        {[
          ["code", "코드순"],
          ["date", "일자순"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={sort === value}
            onClick={() => onSortChange(value as SettlementInquirySort)}
            className={`rounded-[7px] px-[11px] py-[5px] text-[12px] leading-[15px] font-bold ${
              sort === value ? "bg-white text-t1" : "text-t3 hover:text-t2"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <label className="relative h-[38px] w-[200px] shrink-0">
        <SearchIcon className="pointer-events-none absolute left-[11px] top-1/2 z-10 size-[15px] -translate-y-1/2 text-t3" />
        <input
          aria-label="건물명·소재지 검색"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="건물명·소재지 검색"
          className="h-[38px] w-full rounded-[10px] border border-line bg-white pl-[32px] pr-[11px] text-[13px] font-semibold text-t1 outline-none placeholder:text-[#757575] focus:border-blue"
        />
      </label>

      <span className="flex items-start px-[2px]" aria-hidden="true">
        <span className="h-[22px] w-px bg-line" />
      </span>

      <button
        type="button"
        onClick={onPrint}
        aria-disabled={!hasRows}
        className="flex h-[34px] items-center gap-[6px] rounded-[8px] border border-line bg-white px-[14px] text-[13px] font-bold leading-[normal] text-t2 transition-colors hover:bg-bg"
      >
        <PrinterIcon className="size-[15px]" />
        출력
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving}
        className="flex h-[34px] flex-col items-center justify-center rounded-[8px] border border-teal bg-teal px-[16px] text-[13px] font-bold leading-[normal] text-white transition-colors hover:bg-teal-d disabled:border-line disabled:bg-line2 disabled:text-t4"
      >
        저장
      </button>
    </div>
  );
}
