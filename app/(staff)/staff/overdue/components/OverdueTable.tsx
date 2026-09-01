import type { KeyboardEvent } from "react";
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
          period: "—",
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
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[1240px] table-fixed border-separate border-spacing-0 text-[13.5px] text-t1">
        <colgroup>
          <col className="w-[8.15%]" />
          <col className="w-[9.37%]" />
          <col className="w-[5.29%]" />
          <col className="w-[3.18%]" />
          <col className="w-[9.31%]" />
          <col className="w-[8.15%]" />
          <col className="w-[8.15%]" />
          <col className="w-[8.15%]" />
          <col className="w-[9.31%]" />
          <col className="w-[11.93%]" />
          <col className="w-[12.39%]" />
          <col className="w-[6.61%]" />
        </colgroup>
        <thead className="sticky top-0 z-20 bg-[#f7f9fa] text-[11.5px] font-medium text-t3">
          <tr>
            {[
              ["동호", "text-left"],
              ["거래처명", "text-left"],
              ["년월", "text-left"],
              ["연체", "text-right"],
              ["미납액", "text-right"],
              ["납.연체료", "text-right"],
              ["납.후연체", "text-right"],
              ["연체료계", "text-right"],
              ["합계", "text-right"],
              ["비고", "text-left"],
              ["전화", "text-left"],
              ["이름", "text-left"],
            ].map(([label, align]) => (
              <th
                key={label}
                scope="col"
                className={`h-[36.5px] border-b border-line2 px-[16px] ${align}`}
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
                  className="h-[41px] cursor-pointer bg-white transition hover:bg-[#f7fbfb] focus:bg-[#f7fbfb] focus:outline-none"
                >
                  <td className="border-b border-line2 px-[16px] font-medium">{index === 0 ? unit : ""}</td>
                  <td className="border-b border-line2 px-[16px]">{index === 0 ? group.household.buildingName : ""}</td>
                  <td className="border-b border-line2 px-[16px] num">{line.period === "—" ? "—" : formatPeriod(line.period)}</td>
                  <td className="border-b border-line2 px-[16px] text-right num">{line.months}</td>
                  <td className="border-b border-line2 px-[16px] text-right num">{money.format(line.principal)}</td>
                  <td className="border-b border-line2 px-[16px] text-right num">{money.format(line.lateFee)}</td>
                  <td className="border-b border-line2 px-[16px] text-right num">0</td>
                  <td className="border-b border-line2 px-[16px] text-right num">{money.format(line.lateFee)}</td>
                  <td className="border-b border-line2 px-[16px] text-right font-medium num">{money.format(line.principal + line.lateFee)}</td>
                  <td className="border-b border-line2 px-[16px] text-t3">{index === 0 ? group.household.memo ?? group.household.unitMemo ?? "" : ""}</td>
                  <td className="border-b border-line2 px-[16px] num">{index === 0 ? group.household.phone ?? "" : ""}</td>
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
            <th scope="row" colSpan={3} className="border-t border-line px-[16px] text-left">
              항목 {itemCount} / {rows.length}건
            </th>
            <td className="border-t border-line px-[16px]" />
            <td className="border-t border-line px-[16px] text-right num">{money.format(principalTotal)}</td>
            <td className="border-t border-line px-[16px] text-right num">{money.format(lateFeeTotal)}</td>
            <td className="border-t border-line px-[16px] text-right num">0</td>
            <td className="border-t border-line px-[16px] text-right num">{money.format(lateFeeTotal)}</td>
            <td className="border-t border-line px-[16px] text-right num">{money.format(principalTotal + lateFeeTotal)}</td>
            <td className="border-t border-line px-[16px]" />
            <td className="border-t border-line px-[16px]" />
            <td className="border-t border-line px-[16px]" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
