import { CustomDropdown } from "@/components/common";
import { PrinterIcon, SearchIcon } from "@/components/icons";
import type {
  SettlementInquirySort,
  SettlementInquiryStatus,
} from "@/hooks/reactquery/movingSettlement";

interface SettlementInquiryToolbarProps {
  fromMonth: string;
  toMonth: string;
  appliedFrom: string;
  status: "" | SettlementInquiryStatus;
  sort: SettlementInquirySort;
  search: string;
  changedCount: number;
  saving: boolean;
  onFromMonthChange: (value: string) => void;
  onToMonthChange: (value: string) => void;
  onAppliedFromChange: (value: string) => void;
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
function daysInMonth(year: string, month: string): number {
  return new Date(Number(year), Number(month), 0).getDate();
}

function dayOptions(year: string, month: string) {
  return Array.from({ length: daysInMonth(year, month) }, (_, index) => ({
    value: String(index + 1).padStart(2, "0"),
    label: `${String(index + 1).padStart(2, "0")}일`,
  }));
}

/** 말일보다 큰 날짜(2월 31일 등)는 date 캐스팅에서 터지므로 말일로 접는다. */
function clampDay(year: string, month: string, day: string): string {
  return String(Math.min(Number(day), daysInMonth(year, month))).padStart(2, "0");
}

export function SettlementInquiryToolbar({
  fromMonth,
  toMonth,
  appliedFrom,
  status,
  sort,
  search,
  changedCount,
  saving,
  onFromMonthChange,
  onToMonthChange,
  onAppliedFromChange,
  onStatusChange,
  onSortChange,
  onSearchChange,
  onPrint,
  onSave,
}: SettlementInquiryToolbarProps) {
  const [fromYear, fromValue] = fromMonth.split("-");
  const [toYear, toValue] = toMonth.split("-");
  const [appliedYear, appliedMonth, appliedDay] = appliedFrom.split("-");

  return (
    <div className="flex h-[65px] min-w-[1160px] items-center gap-[8px] border-b border-line2 bg-white px-[16px] py-[13px]">
      {/* 라벨·세그먼트는 정본 .ov-lbl·.adj-seg2 처럼 글자 폭 그대로 둔다 — 09-18 Figma 고정 폭
          (라벨 34·9px, 세그먼트 145·120px)은 정본 .dc.html 과 최대 16px 어긋났다. */}
      <span className="shrink-0 text-[12px] font-bold text-t3">조회일</span>
      {/* position: 툴바를 감싼 `overflow-x-auto` 는 overflow-y 도 auto 로 계산돼 65px 높이의
          스크롤포트가 된다 — absolute 메뉴는 여기서 잘려 그리드에 가린 것처럼 보인다.
          fixed 로 띄워 빠져나간다(전체 이사조회도 같은 사유로 fixed).
          check: 정본 moving-gas·moving-elec·moving-water 는 `.uc-opt svg{opacity:0}` 만 두고
          `.uc-opt.on svg{opacity:1}` 이 없다 — 선택 표시는 배경·색·굵기뿐이고 체크는 안 뜬다. */}
      <CustomDropdown
        menuTransition
        compact
        position="fixed"
        check="never"
        ariaLabel="조회 시작 연도"
        value={fromYear}
        options={YEAR_OPTIONS}
        onChange={(value) => onFromMonthChange(`${value}-${fromValue}`)}
      />
      <CustomDropdown
        menuTransition
        compact
        position="fixed"
        check="never"
        ariaLabel="조회 시작 월"
        value={fromValue}
        options={MONTH_OPTIONS}
        onChange={(value) => onFromMonthChange(`${fromYear}-${value}`)}
      />
      <span className="shrink-0 text-[12px] font-bold text-t3">~</span>
      <CustomDropdown
        menuTransition
        compact
        position="fixed"
        check="never"
        ariaLabel="조회 종료 연도"
        value={toYear}
        options={YEAR_OPTIONS}
        onChange={(value) => onToMonthChange(`${value}-${toValue}`)}
      />
      <CustomDropdown
        menuTransition
        compact
        position="fixed"
        check="never"
        ariaLabel="조회 종료 월"
        value={toValue}
        options={MONTH_OPTIONS}
        onChange={(value) => onToMonthChange(`${toYear}-${value}`)}
      />

      <span className="mx-[2px] h-[22px] w-px shrink-0 bg-line" aria-hidden="true" />

      <span className="shrink-0 text-[12px] font-bold text-t3">신청일</span>
      <CustomDropdown
        menuTransition
        compact
        position="fixed"
        check="never"
        ariaLabel="신청일 연도"
        value={appliedYear}
        options={YEAR_OPTIONS}
        onChange={(value) =>
          onAppliedFromChange(
            `${value}-${appliedMonth}-${clampDay(value, appliedMonth, appliedDay)}`,
          )
        }
      />
      <CustomDropdown
        menuTransition
        compact
        position="fixed"
        check="never"
        ariaLabel="신청일 월"
        value={appliedMonth}
        options={MONTH_OPTIONS}
        onChange={(value) =>
          onAppliedFromChange(
            `${appliedYear}-${value}-${clampDay(appliedYear, value, appliedDay)}`,
          )
        }
      />
      <CustomDropdown
        menuTransition
        compact
        position="fixed"
        check="never"
        ariaLabel="신청일 일"
        value={appliedDay}
        options={dayOptions(appliedYear, appliedMonth)}
        onChange={(value) => onAppliedFromChange(`${appliedYear}-${appliedMonth}-${value}`)}
      />

      {/* 정본 .adj-seg2 — 버튼 패딩 5/11px·줄높이 normal(높이 24, 틀 30), 선택 버튼 그림자 없음 */}
      <div className="flex shrink-0 gap-[2px] rounded-[9px] bg-[#EDF0F3] p-[3px]" role="group" aria-label="정산 상태">
        {([
          ["", "전체"],
          ["completed", "완결"],
          ["incomplete", "미결"],
        ] as const).map(([value, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={status === value}
            onClick={() => onStatusChange(value)}
            className={`whitespace-nowrap rounded-[7px] px-[11px] py-[5px] text-[12px] font-bold leading-[normal] ${
              status === value ? "bg-white text-t1" : "text-t3"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 gap-[2px] rounded-[9px] bg-[#EDF0F3] p-[3px]" role="group" aria-label="정렬">
        {([
          ["code", "코드순"],
          ["date", "일자순"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={sort === value}
            onClick={() => onSortChange(value)}
            className={`whitespace-nowrap rounded-[7px] px-[11px] py-[5px] text-[12px] font-bold leading-[normal] ${
              sort === value ? "bg-white text-t1" : "text-t3"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-w-[18px] flex-1" />

      <label className="relative h-[38px] w-[200px] shrink-0">
        {/* building-register 도형 = 정본 .ov-search 돋보기(24칸 원 r7·선 2)를 16칸으로 환산한 것과 같다 */}
        <SearchIcon variant="building-register" className="pointer-events-none absolute left-[11px] top-[11.5px] z-10 size-[15px] text-t3" />
        <input
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
        className="flex h-[34px] shrink-0 items-center justify-center gap-[6px] whitespace-nowrap rounded-[8px] border border-line bg-white px-[14px] text-[13px] font-bold leading-[normal] text-t2 hover:bg-bg"
      >
        <PrinterIcon className="size-[15px]" />
        출력
      </button>
      <button
        type="button"
        disabled={changedCount === 0 || saving}
        onClick={onSave}
        className="h-[34px] shrink-0 whitespace-nowrap rounded-[8px] border border-teal bg-teal px-[16px] text-[13px] font-bold leading-[normal] text-white hover:bg-teal-d disabled:border-line disabled:bg-line2 disabled:text-t4"
      >
        저장
      </button>
    </div>
  );
}
