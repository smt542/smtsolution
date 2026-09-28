import { computeLateFeeForPeriod, type RateTier } from "@/lib/billing/lateFee";
import type { OverdueHousehold, OverduePeriodRow } from "@/hooks/reactquery/overdue";

/**
 * 빌라 미납내역 모달 뷰모델 빌더.
 *
 * `list_overdue_periods`(세대·부과월별 미납원금)와 세대 정보(useOverdueHouseholds)를
 * 결합하고, 요율표(late_fee_rate_tiers)로 부과월별 연체료를 계산해 동호 단위로 묶는다.
 * 편집 오버라이드는 모달 상태에서 관리하고, 여기서는 순수 시드값만 만든다.
 */

export interface OverdueSeedLine {
  key: string; // `${occupancyId}:${period}`
  period: string; // 원본 부과월 ('YYYY-MM-01')
  overdueMonths: number; // 연체 개월수
  unpaidPrincipal: number; // 미납액 시드
  lateFee: number; // 납.연체료 시드(계산값)
  postDueFee: number; // 납.후연체(납기후 가산금)
}

export interface OverdueUnitGroup {
  occupancyId: number;
  unitId: number;
  unitLabel: string; // 동호 표기
  tenantName: string | null;
  phone: string | null;
  lines: OverdueSeedLine[];
}

export interface OverdueLineOverride {
  unpaid?: number;
  lateFee?: number;
  postLate?: number;
  /** 정본 feeSumFix: 연체료계를 직접 고치면 납.연체료+납.후연체 대신 이 값을 쓴다. */
  lateTotal?: number;
  note?: string;
}

export interface OverdueDisplayLine extends OverdueSeedLine {
  unpaid: number; // 미납액(편집 반영)
  displayLateFee: number; // 납.연체료(편집 반영)
  postLate: number; // 납.후연체
  lateTotal: number; // 연체료계 = 납.연체료 + 납.후연체
  total: number; // 합계 = 미납액 + 연체료계
  note: string; // 비고
}

export interface OverdueRollup {
  unpaid: number;
  lateFee: number;
  postLate: number;
  lateTotal: number;
  total: number;
}

export function lineKey(occupancyId: number, period: string): string {
  return `${occupancyId}:${period}`;
}

function unitLabelOf(household: { dong?: string | null; unitNo: string }): string {
  return household.dong ? `${household.dong}-${household.unitNo}` : household.unitNo;
}

export function buildOverdueGroups(
  periods: OverduePeriodRow[],
  households: OverdueHousehold[],
  tiers: RateTier[],
  asOf: { year: number; month: number },
): OverdueUnitGroup[] {
  const byOccupancy = new Map<number, OverdueHousehold>();
  for (const household of households) byOccupancy.set(household.occupancyId, household);

  const groups = new Map<number, OverdueUnitGroup>();
  for (const period of periods) {
    const household = byOccupancy.get(period.occupancyId);
    const { months, lateFee, postDueFee } = computeLateFeeForPeriod(
      {
        period: period.period,
        unpaidPrincipal: period.unpaidPrincipal,
        dueDate: period.dueDate,
      },
      tiers,
      asOf.year,
      asOf.month,
    );
    const line: OverdueSeedLine = {
      key: lineKey(period.occupancyId, period.period),
      period: period.period,
      overdueMonths: months,
      unpaidPrincipal: period.unpaidPrincipal,
      lateFee,
      postDueFee,
    };
    let group = groups.get(period.occupancyId);
    if (!group) {
      group = {
        occupancyId: period.occupancyId,
        unitId: period.unitId,
        unitLabel: household ? unitLabelOf(household) : String(period.unitId),
        tenantName: household?.tenantName ?? null,
        phone: household?.phone ?? null,
        lines: [],
      };
      groups.set(period.occupancyId, group);
    }
    group.lines.push(line);
  }

  const result = [...groups.values()];
  for (const group of result) {
    group.lines.sort((a, b) => b.period.localeCompare(a.period));
  }
  result.sort((a, b) => a.unitLabel.localeCompare(b.unitLabel, "ko-KR"));
  return result;
}

export function mergeLine(
  seed: OverdueSeedLine,
  override: OverdueLineOverride | undefined,
): OverdueDisplayLine {
  const unpaid = override?.unpaid ?? seed.unpaidPrincipal;
  const displayLateFee = override?.lateFee ?? seed.lateFee;
  const postLate = override?.postLate ?? seed.postDueFee;
  const lateTotal = override?.lateTotal ?? displayLateFee + postLate;
  return {
    ...seed,
    unpaid,
    displayLateFee,
    postLate,
    lateTotal,
    total: unpaid + lateTotal,
    note: override?.note ?? "",
  };
}

export function rollup(lines: OverdueDisplayLine[]): OverdueRollup {
  return lines.reduce<OverdueRollup>(
    (acc, line) => ({
      unpaid: acc.unpaid + line.unpaid,
      lateFee: acc.lateFee + line.displayLateFee,
      postLate: acc.postLate + line.postLate,
      lateTotal: acc.lateTotal + line.lateTotal,
      total: acc.total + line.total,
    }),
    { unpaid: 0, lateFee: 0, postLate: 0, lateTotal: 0, total: 0 },
  );
}

export interface OverdueDisplayGroup {
  occupancyId: number;
  unitLabel: string;
  tenantName: string | null;
  phone: string | null;
  lines: OverdueDisplayLine[];
  rollup: OverdueRollup;
}

/** 시드 그룹 + 편집 오버라이드 → 렌더용 표시 그룹(합계 롤업 포함). 모달·인쇄뷰 공용. */
export function toDisplayGroups(
  groups: OverdueUnitGroup[],
  overrides: Record<string, OverdueLineOverride>,
): OverdueDisplayGroup[] {
  return groups.map((group) => {
    const lines = group.lines.map((line) => mergeLine(line, overrides[line.key]));
    return {
      occupancyId: group.occupancyId,
      unitLabel: group.unitLabel,
      tenantName: group.tenantName,
      phone: group.phone,
      lines,
      rollup: rollup(lines),
    };
  });
}

/** 전체 표시 그룹의 총계(footer). */
export function grandTotals(groups: OverdueDisplayGroup[]): OverdueRollup & {
  lineCount: number;
  unitCount: number;
} {
  const base = groups.reduce<OverdueRollup>(
    (acc, group) => ({
      unpaid: acc.unpaid + group.rollup.unpaid,
      lateFee: acc.lateFee + group.rollup.lateFee,
      postLate: acc.postLate + group.rollup.postLate,
      lateTotal: acc.lateTotal + group.rollup.lateTotal,
      total: acc.total + group.rollup.total,
    }),
    { unpaid: 0, lateFee: 0, postLate: 0, lateTotal: 0, total: 0 },
  );
  const lineCount = groups.reduce((sum, group) => sum + group.lines.length, 0);
  return { ...base, lineCount, unitCount: groups.length };
}
