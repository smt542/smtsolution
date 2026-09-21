import type { OverdueHousehold, OverduePeriodRow } from "@/hooks/reactquery/overdue";

/**
 * 미납 표의 행 모델. 화면(OverdueTable)과 인쇄물(OverdueLedgerPrintView)이 같은 행을
 * 그려야 하므로 여기 한 군데서만 만든다 — 정본도 표와 인쇄 시트가 같은 `pRows` 를 쓴다.
 *
 * 세대(occupancy)마다 미납 월분을 최신순으로 늘어놓고 뒤에 `[호합]` 소계를 붙인다.
 * 월분 데이터가 없으면 집계값 한 줄로 대체한다(년월 "-").
 */
export interface OverduePeriodLine {
  key: string;
  period: string;
  months: number;
  principal: number;
  lateFee: number;
  /** 납기후 가산금("납.후연체"). */
  postDueFee: number;
}

export interface OverdueHouseholdGroup {
  household: OverdueHousehold;
  lines: OverduePeriodLine[];
  principal: number;
  lateFee: number;
  postDueFee: number;
}

/** 정본 `r.ym` 과 같은 `YYYY/MM`. */
export function formatOverduePeriod(value: string): string {
  const [year, month] = value.split("-");
  return year && month ? `${year}/${month}` : value;
}

/** 정본 `r.du` 와 같은 동호 표기. */
export function formatOverdueUnit(household: OverdueHousehold): string {
  return [household.dong, household.unitNo].filter(Boolean).join("-");
}

export function buildOverdueGroups(
  rows: OverdueHousehold[],
  periods: OverduePeriodRow[],
): OverdueHouseholdGroup[] {
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
            postDueFee: lateFee?.postDueFee ?? 0,
          };
        })
      : [{
          key: `${household.occupancyId}:aggregate`,
          period: "-",
          months: household.overdueMonths,
          principal: household.overdueAmount,
          lateFee: household.lateFeeAmount ?? 0,
          postDueFee: household.postDueFeeAmount ?? 0,
        }];

    return {
      household,
      lines,
      principal: lines.reduce((sum, line) => sum + line.principal, 0),
      lateFee: lines.reduce((sum, line) => sum + line.lateFee, 0),
      postDueFee: lines.reduce((sum, line) => sum + line.postDueFee, 0),
    };
  });
}

export interface OverdueTotals {
  /** 소계행을 뺀 부과 행 수. 정본 합계행의 "합계 N 건". */
  lineCount: number;
  principal: number;
  lateFee: number;
  postDueFee: number;
}

export function sumOverdueGroups(groups: OverdueHouseholdGroup[]): OverdueTotals {
  return {
    lineCount: groups.reduce((sum, group) => sum + group.lines.length, 0),
    principal: groups.reduce((sum, group) => sum + group.principal, 0),
    lateFee: groups.reduce((sum, group) => sum + group.lateFee, 0),
    postDueFee: groups.reduce((sum, group) => sum + group.postDueFee, 0),
  };
}
