import type { KeyboardEvent } from "react";
import { MaskedPhone } from "@/components/common/MaskedPhone";
import type { OverdueHousehold, OverduePeriodRow } from "@/hooks/reactquery/overdue";

interface OverdueTableProps {
  rows: OverdueHousehold[];
  periods?: OverduePeriodRow[];
  onRowClick: (row: OverdueHousehold) => void;
  selectedIds?: Set<number>;
  onToggleOne?: (occupancyId: number) => void;
  onToggleAll?: () => void;
}

interface PeriodLine {
  key: string;
  period: string;
  months: number;
  principal: number;
  lateFee: number;
}

interface HouseholdGroup {
  household: OverdueHousehold;
  lines: PeriodLine[];
  principal: number;
  lateFee: number;
}

// 정본 `#ovBody` 표 헤더의 min-width/width 를 그대로 옮겼다. 정본은 table-layout:auto 라
// 이 값들이 하한이고 남는 폭은 자동 분배된다 — table-fixed + % 로 바꾸면 컬럼이 넓어져
// "연체" 헤더가 줄바꿈되고 가로 스크롤이 과도해진다.
const COLUMNS = [
  { label: "동호", align: "text-left", width: "min-w-[82px]" },
  { label: "거래처명", align: "text-left", width: "min-w-[96px]" },
  { label: "년월", align: "text-left", width: "w-[74px]" },
  { label: "연체", align: "text-right", width: "w-[46px]" },
  { label: "미납액", align: "text-right", width: "min-w-[82px]" },
  { label: "납.연체료", align: "text-right", width: "min-w-[82px]" },
  { label: "납.후연체", align: "text-right", width: "min-w-[82px]" },
  { label: "연체료계", align: "text-right", width: "min-w-[82px]" },
  { label: "합계", align: "text-right", width: "min-w-[88px]" },
  { label: "비고", align: "text-left", width: "min-w-[130px]" },
  { label: "전화", align: "text-left", width: "min-w-[118px]" },
  { label: "이름", align: "text-left", width: "min-w-[72px]" },
] as const;

const money = new Intl.NumberFormat("ko-KR");

function formatPeriod(value: string): string {
  const [year, month] = value.split("-");
  return year && month ? `${year}/${month}` : value;
}

function buildGroups(rows: OverdueHousehold[], periods: OverduePeriodRow[]): HouseholdGroup[] {
  return rows.map((household) => {
    const periodLateFee = new Map(
      (household.lateFeeByPeriod ?? []).map((item) => [item.period, item]),
    );
    const householdPeriods = periods
      .filter(
        (period) =>
          period.occupancyId === household.occupancyId &&
          period.unitId === household.unitId,
      )
      .sort((a, b) => b.period.localeCompare(a.period));
    const lines = householdPeriods.length > 0
      ? householdPeriods.map((period) => {
          const lateFee = periodLateFee.get(period.period);
          return {
            key: `${household.occupancyId}:${period.period}`,
            period: period.period,
            months: lateFee?.months ?? household.overdueMonths,
            principal: period.unpaidPrincipal,
            lateFee: lateFee?.lateFee ?? 0,
          };
        })
      : [{
          key: `${household.occupancyId}:aggregate`,
          period: "-",
          months: household.overdueMonths,
          principal: household.overdueAmount,
          lateFee: household.lateFeeAmount ?? 0,
        }];

    return {
      household,
      lines,
      principal: lines.reduce((sum, line) => sum + line.principal, 0),
      lateFee: lines.reduce((sum, line) => sum + line.lateFee, 0),
    };
  });
}

export function OverdueTable({ rows, periods = [], onRowClick }: OverdueTableProps) {
  const groups = buildGroups(rows, periods);
  const itemCount = groups.reduce((sum, group) => sum + group.lines.length, 0);
  const principalTotal = groups.reduce((sum, group) => sum + group.principal, 0);
  const lateFeeTotal = groups.reduce((sum, group) => sum + group.lateFee, 0);

  const openWithKeyboard = (
    event: KeyboardEvent<HTMLTableRowElement>,
    row: OverdueHousehold,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-b-[16px] bg-white">
      <table className="w-full whitespace-nowrap border-separate border-spacing-0 text-[13.5px] text-t1">
        <thead className="sticky top-0 z-20 bg-[#f7f9fa] text-[11.5px] font-medium text-t3">
          <tr>
            {COLUMNS.map(({ label, align, width }) => (
              <th
                key={label}
                scope="col"
                className={`h-[36.5px] border-b border-line bg-[#f7f9fa] px-[16px] font-medium ${align} ${width}`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const unit = [group.household.dong, group.household.unitNo]
              .filter(Boolean)
              .join("-");
            return [
              ...group.lines.map((line, index) => (
                <tr
                  key={line.key}
                  tabIndex={0}
                  aria-label={`${unit} ${group.household.tenantName ?? "입주자 미등록"} 상세 보기`}
                  onClick={() => onRowClick(group.household)}
                  onKeyDown={(event) => openWithKeyboard(event, group.household)}
                  className="h-[41px] cursor-pointer bg-white transition hover:bg-[#fbfcfd] focus:bg-[#fbfcfd] focus:outline-none"
                >
                  <td className="border-b border-line2 px-[16px] font-medium">{index === 0 ? unit : ""}</td>
                  <td className="border-b border-line2 px-[16px]">{index === 0 ? group.household.buildingName : ""}</td>
                  <td className="border-b border-line2 px-[16px] num">{line.period === "-" ? "-" : formatPeriod(line.period)}</td>
                  <td className="border-b border-line2 px-[16px] text-right num">{line.months}</td>
                  <td className="border-b border-line2 px-[16px] text-right num">{money.format(line.principal)}</td>
                  <td className="border-b border-line2 px-[16px] text-right num">{money.format(line.lateFee)}</td>
                  <td className="border-b border-line2 px-[16px] text-right num">0</td>
                  <td className="border-b border-line2 px-[16px] text-right num">{money.format(line.lateFee)}</td>
                  <td className="border-b border-line2 px-[16px] text-right font-medium num">{money.format(line.principal + line.lateFee)}</td>
                  <td className="border-b border-line2 px-[16px] text-t3">{index === 0 ? group.household.memo ?? group.household.unitMemo ?? "" : ""}</td>
                  <td className="border-b border-line2 px-[16px] num">
                    {index === 0 && group.household.phone ? (
                      <MaskedPhone
                        value={group.household.phone}
                        kind="phone"
                        reveal={{ targetKind: "occupancy", targetId: group.household.occupancyId, field: "phone" }}
                      />
                    ) : (
                      ""
                    )}
                  </td>
                  <td className="border-b border-line2 px-[16px]">{index === 0 ? group.household.tenantName ?? "미등록" : ""}</td>
                </tr>
              )),
              <tr key={`${group.household.occupancyId}:subtotal`} className="h-[41px] bg-white font-semibold">
                <td className="border-b border-line2 px-[16px]" />
                <td className="border-b border-line2 px-[16px]" />
                <td className="border-b border-line2 px-[16px]">[호합]</td>
                <td className="border-b border-line2 px-[16px]" />
                <td className="border-b border-line2 px-[16px] text-right num">{money.format(group.principal)}</td>
                <td className="border-b border-line2 px-[16px] text-right num">{money.format(group.lateFee)}</td>
                <td className="border-b border-line2 px-[16px] text-right num">0</td>
                <td className="border-b border-line2 px-[16px] text-right num">{money.format(group.lateFee)}</td>
                <td className="border-b border-line2 px-[16px] text-right num">{money.format(group.principal + group.lateFee)}</td>
                <td className="border-b border-line2 px-[16px]" />
                <td className="border-b border-line2 px-[16px]" />
                <td className="border-b border-line2 px-[16px]" />
              </tr>,
            ];
          })}
        </tbody>
        <tfoot className="sticky bottom-0 z-20 bg-[#f7f9fa] font-bold text-t1">
          <tr className="h-[38.5px]">
            <th scope="row" colSpan={3} className="rounded-bl-[16px] border-t border-line bg-[#f7f9fa] px-[16px] text-left">
              항목 {itemCount} / {rows.length}건
            </th>
            <td className="border-t border-line bg-[#f7f9fa] px-[16px]" />
            <td className="border-t border-line bg-[#f7f9fa] px-[16px] text-right num">{money.format(principalTotal)}</td>
            <td className="border-t border-line bg-[#f7f9fa] px-[16px] text-right num">{money.format(lateFeeTotal)}</td>
            <td className="border-t border-line bg-[#f7f9fa] px-[16px] text-right num">0</td>
            <td className="border-t border-line bg-[#f7f9fa] px-[16px] text-right num">{money.format(lateFeeTotal)}</td>
            <td className="border-t border-line bg-[#f7f9fa] px-[16px] text-right num">{money.format(principalTotal + lateFeeTotal)}</td>
            <td className="border-t border-line bg-[#f7f9fa] px-[16px]" />
            <td className="border-t border-line bg-[#f7f9fa] px-[16px]" />
            <td className="rounded-br-[16px] border-t border-line bg-[#f7f9fa] px-[16px]" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
