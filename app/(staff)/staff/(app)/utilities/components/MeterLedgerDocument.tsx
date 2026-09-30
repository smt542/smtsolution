import type { Building } from "@/hooks/reactquery/buildings";
import type { UtilityType, UtilityUnitRow } from "@/hooks/reactquery/utilities";
import { formatNumber } from "@/lib/format";

/**
 * 검침대장 문서. 정본 `utility-*.dc.html` 의 `.lg-page` 를 옮겼다(세 탭 공통).
 * 화면에서는 794px 쪽을 미리보기 폭에 맞춰 축소하고, 인쇄는 `METER_LEDGER_PRINT_CSS` 가
 * 쪽 폭·여백·테두리를 풀어 A4 에 그대로 찍는다.
 */
export const LEDGER_PAGE_WIDTH = 794;
const ROWS_PER_PAGE = 12;
const UTILITIES: { type: UtilityType; label: string }[] = [
  { type: "electricity", label: "전기" },
  { type: "water", label: "수도" },
  { type: "gas", label: "가스" },
];
const READING_LABELS = ["전월", "금월", "량", "전량", "평균"];
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const DISCOUNT_LABELS: Record<string, string> = { recipient: "수급자", multichild: "다자녀" };

export interface MeterLedgerSource {
  building: Building;
  rows: UtilityUnitRow[];
  waterCustomerNumbers: string[];
  electricityCustomerNumbers: string[];
}

/** 정본 `@media print` 규칙: 쪽 폭·최소 높이·테두리·여백을 풀고 쪽마다 넘긴다. PrintSheet 의 css 로 쓴다. */
export const METER_LEDGER_PRINT_CSS = `
@page{size:A4;margin:14mm}
[data-lg-page]{width:auto!important;min-height:0!important;border:none!important;border-radius:0!important;margin:0!important;padding:0!important;break-after:page}
[data-lg-page]:last-child{break-after:auto}
[data-lg-pn]{display:none!important}
`;

const CELL = "h-[17px] border border-[#111] px-1 py-[3px] text-center";
const META_KEY = "w-[74px] flex-none border-r border-[#111] bg-[#F5F6F7] px-1.5 py-[5px] text-center font-bold";
// flex 값은 칸마다 하나만 준다(flex-1 과 flex-[0_0_158px] 를 겹치면 CSS 생성 순서가 이긴다).
const META_VALUE = "min-w-0 truncate border-r border-[#111] px-2 py-[5px] last:border-r-0";

function reading(value: number | null | undefined): string {
  return formatNumber(value, { nullText: "", fractionDigits: 3 });
}

function usageOf(row: UtilityUnitRow): number | null {
  if (row.usage !== null) return row.usage;
  return row.currentReading !== null && row.previousReading !== null
    ? row.currentReading - row.previousReading
    : null;
}

function isVacant(row: UtilityUnitRow): boolean {
  return row.occupancyStatus === "vacant" || row.occupancyId === null;
}

/** 정본 메모 줄: 여러 항목을 ` · ` 로 잇는다(계량기 없음 · 할인 · 적요). */
function memoOf(row: UtilityUnitRow): string {
  const memo: string[] = [];
  if (row.meterNumber === null) memo.push("계량기 없음");
  if (row.discountAmount !== null && row.discountAmount > 0) {
    const label = row.discountType ? DISCOUNT_LABELS[row.discountType] ?? row.discountType : "할인";
    memo.push(`${label} ${formatNumber(row.discountAmount)}원`);
  }
  if (row.note) memo.push(row.note);
  return memo.join(" · ");
}

/** 건물 청소 업체의 '청소 요일'(예: "월,목"·"월요일, 목요일")에서 요일을 뽑는다. */
function cleaningDays(building: Building): Set<string> {
  const text = building.vendorDetails?.vendors?.cleaning?.fields?.["청소 요일"] ?? "";
  return new Set(text.replace(/요일/g, "").match(/[일월화수목금토]/g) ?? []);
}

function sortedRows(rows: UtilityUnitRow[]): UtilityUnitRow[] {
  return [...rows].sort((a, b) => a.unitNo.localeCompare(b.unitNo, "ko-KR", { numeric: true }));
}

function chunk<T>(items: T[]): T[][] {
  if (items.length === 0) return [[]];
  return Array.from({ length: Math.ceil(items.length / ROWS_PER_PAGE) }, (_, index) => (
    items.slice(index * ROWS_PER_PAGE, (index + 1) * ROWS_PER_PAGE)
  ));
}

function UnitRows({ row, no, utilityType }: { row: UtilityUnitRow; no: number; utilityType: UtilityType }) {
  const vacant = isVacant(row);
  const usage = usageOf(row);
  return (
    <>
      <tr>
        <td rowSpan={2} className={`${CELL} font-bold`}>{row.unitNo.replace(/호$/, "")}</td>
        {UTILITIES.map(({ type }) => {
          if (type !== utilityType) {
            return READING_LABELS.map((label) => <td key={`${type}:${label}`} className={CELL} />);
          }
          if (vacant) {
            return <td key={type} colSpan={5} className={`${CELL} text-[#888]`}>공실</td>;
          }
          return [row.previousReading, row.currentReading, usage, null, null].map((value, index) => (
            <td key={`${type}:${READING_LABELS[index]}`} className={`${CELL} text-right`}>{reading(value)}</td>
          ));
        })}
        <td rowSpan={2} className={`${CELL} text-right`}>{no}</td>
        <td rowSpan={2} className={`${CELL} text-right`} />
      </tr>
      <tr>
        <td colSpan={15} className={`${CELL} text-[10px] text-[#333]`}>{memoOf(row) || " "}</td>
      </tr>
    </>
  );
}

function LedgerPages({ source, period, utilityType }: { source: MeterLedgerSource; period: string; utilityType: UtilityType }) {
  const { building } = source;
  const rows = sortedRows(source.rows);
  const pages = chunk(rows);
  const days = cleaningDays(building);
  const subtotal = rows.reduce((total, row) => total + (isVacant(row) ? 0 : usageOf(row) ?? 0), 0);
  const title = `[ ${period.slice(0, 4)} 년 ${period.slice(5, 7)} 월분 검침대장 ]`;

  return (
    <>
      {pages.map((pageRows, pageIndex) => (
        <article
          key={`${building.id}:${pageIndex}`}
          data-lg-page
          className="mb-4 box-border flex min-h-[1123px] w-[794px] flex-none flex-col rounded-[4px] border border-line bg-white px-[38px] py-10 leading-[normal] text-[#111]"
        >
          <h1 className="mb-3.5 text-center text-[17px] font-extrabold tracking-[0.06em]">{title}</h1>

          <div className="mb-2 border border-[#111]">
            <div className="flex items-stretch border-b border-[#111] text-[11px]">
              <span className={META_KEY}>주소/빌라명</span>
              <span className={`${META_VALUE} flex-1`}>{building.address?.trim() || "-"}</span>
              <span className={`${META_VALUE} flex-1 font-bold`}>{building.name}</span>
              <span className={META_KEY}>키번호</span>
              <span className={`${META_VALUE} flex-[0_0_158px]`}>{building.entrancePassword ?? ""}</span>
            </div>
            <div className="flex items-stretch border-b border-[#111] text-[11px]">
              <span className={META_KEY}>수도정보</span>
              <span className={`${META_VALUE} flex-1`}>
                {source.waterCustomerNumbers.length > 0 ? `고객번호 ${source.waterCustomerNumbers.join(" · ")}` : ""}
              </span>
              <span className={META_KEY}>전기정보</span>
              <span className={`${META_VALUE} flex-[0_0_158px]`}>
                {source.electricityCustomerNumbers.length > 0 ? `고객번호 ${source.electricityCustomerNumbers.join(" · ")}` : ""}
              </span>
            </div>
            <div className="flex items-stretch text-[11px]">
              <span className={META_KEY}>청소정보</span>
              {/* 정본 `.lg-day::after` 만 content-box 다(9px + 테두리 = 11px). */}
              <span className="flex flex-none gap-[9px] border-r border-[#111] px-2 py-[5px]">
                {WEEKDAYS.map((day) => (
                  <span key={day} className="inline-flex items-center gap-[3px] font-semibold">
                    {day}
                    <i className={`box-content inline-block size-[9px] border border-[#111] ${days.has(day) ? "bg-[#111]" : ""}`} />
                  </span>
                ))}
              </span>
              <span className={META_KEY}>전화번호</span>
              <span className={`${META_VALUE} flex-1`}>{building.ownerPhone ?? ""}</span>
            </div>
          </div>

          <table className="w-full border-collapse text-[10.5px] tabular-nums">
            <thead className="[&_th]:bg-[#F5F6F7] [&_th]:font-bold">
              <tr>
                <th rowSpan={2} className={CELL}>호수</th>
                {UTILITIES.map(({ type, label }) => <th key={type} colSpan={5} className={CELL}>{label}검침</th>)}
                <th rowSpan={2} className={CELL}>NO</th>
                <th rowSpan={2} className={CELL}>미납액</th>
              </tr>
              <tr>
                {UTILITIES.map(({ type }) => READING_LABELS.map((label) => (
                  <th key={`${type}:${label}`} className={CELL}>{label}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => (
                <UnitRows key={row.unitId} row={row} no={pageIndex * ROWS_PER_PAGE + index + 1} utilityType={utilityType} />
              ))}
            </tbody>
          </table>

          {pageIndex === pages.length - 1 && (
            <div className="grid grid-cols-3 border border-t-0 border-[#111]">
              {UTILITIES.map(({ type, label }) => (
                <div key={type} className="flex min-h-[22px] items-center border-r border-[#111] last:border-r-0">
                  <span className="w-1/2 flex-none border-r border-[#111] bg-[#F5F6F7] px-1.5 py-[3px] text-center text-[10.5px] font-bold">{label}소계</span>
                  <b className="flex-1 px-1.5 py-[3px] text-right text-[10.5px] font-bold tabular-nums">
                    {type === utilityType && subtotal !== 0 ? reading(subtotal) : ""}
                  </b>
                </div>
              ))}
            </div>
          )}

          <p data-lg-pn className="mt-auto pt-3.5 text-center text-[10.5px] text-[#888]">
            {building.name} · {pageIndex + 1} / {pages.length}
          </p>
        </article>
      ))}
    </>
  );
}

/** 선택한 건물들의 쪽을 한 줄로 이어 붙인다(인쇄 `:last-child` 규칙이 마지막 쪽만 잡도록 평평하게). */
export function MeterLedgerDocument({
  sources,
  period,
  utilityType,
}: {
  sources: MeterLedgerSource[];
  period: string;
  utilityType: UtilityType;
}) {
  return (
    <>
      {sources.map((source) => (
        <LedgerPages key={source.building.id} source={source} period={period} utilityType={utilityType} />
      ))}
    </>
  );
}
