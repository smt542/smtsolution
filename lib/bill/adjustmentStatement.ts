// lib/bill/adjustmentStatement.ts
//
// 조정명세서(가로 A4 밀도표)의 순수 데이터 모델 빌더. React 의존성 없음.
// 화면 미리보기·인쇄 컴포넌트(AdjustmentStatementPreview)가 공유하는 페이지 모델을 만든다.
//
// 부과·미납·연체료 값은 앱의 정본 소스만 사용한다:
//  - 관리비 항목/당월계 : 확정 부과(get_bill_documents) 항목·총액
//  - 검침(당월/전월/량)  : 등록 항목 순서상 '첫 계량 항목'(수도/전기/가스)의 list_utility_rows 지침
//  - 미납액/연체료        : /overdue 정본 엔진(list_overdue_periods + lib/billing/lateFee)
//  - 수납일              : payments.max(paid_at)
//
// 미납·연체 4개 값의 업무 정의는 아래 buildRow에 한 곳으로 모아 두었다. 회사별 정의가
// 다르면 이 매핑만 고치면 된다.
import { giroDocumentAmount, type BillItem } from "./document";
import {
  computeLateFee,
  computeLateFeeForPeriod,
  type OverduePeriodInput,
  type RateTier,
} from "@/lib/billing/lateFee";

export type MeterUtility = "water" | "electricity" | "gas";

/** 항목명으로 계량 종목을 판별한다. 계량 항목이 아니면 null(예: 일반관리비·정화조). */
export function utilityForItemName(name: string): MeterUtility | null {
  if (name.includes("전기")) return "electricity";
  if (name.includes("가스")) return "gas";
  if (name.includes("수도")) return "water";
  return null;
}

export interface AdjustmentMeterInput {
  unitId: number;
  unitNo: string;
  dong: string | null;
  currentReading: number | null;
  previousReading: number | null;
  usage: number | null;
  occupancyStatus: "occupied" | "vacant" | "moving_out" | null;
}

export interface AdjustmentTargetInput {
  unitId: number;
  unitNo: string;
  dong: string | null;
  payerName: string | null;
  tenantName: string | null;
  phone: string | null;
}

export interface AdjustmentDocumentInput {
  unitId: number;
  totalAmount: number;
  items: BillItem[];
}

export interface AdjustmentOverdueInput {
  unitId: number;
  period: string; // 'YYYY-MM-01'
  unpaidPrincipal: number;
  dueDate: string;
}

export interface AdjustmentBuildingInput {
  building: { id: number; code: string; name: string; address: string | null };
  targets: AdjustmentTargetInput[];
  documents: AdjustmentDocumentInput[];
  /** 종목별 검침. 검침 블록은 '등록 항목 순서상 첫 계량 항목'의 종목만 표시한다. */
  metersByUtility: Record<MeterUtility, AdjustmentMeterInput[]>;
  overduePeriods: AdjustmentOverdueInput[];
  paidDateByUnit: Map<number, string>; // unitId -> 'YYYY-MM-DD'
}

export interface BuildAdjustmentParams {
  buildings: AdjustmentBuildingInput[];
  period: string; // 'YYYY-MM-01'
  companyName: string;
  outputDate: string; // 표시용 문자열 (예: '2026-09-16 13:00')
  tiers: RateTier[];
}

export interface AdjustmentMeterCell {
  current: number | null;
  previous: number | null;
  usage: number | null;
}

export interface AdjustmentStatementRow {
  unitId: number;
  unitNo: string;
  dong: string | null;
  name: string;
  phone: string | null;
  paidDate: string | null;
  meter: AdjustmentMeterCell;
  /** page.feeItemNames 순서와 정렬. 미부과 항목=0, 비부과 세대=null. */
  itemAmounts: (number | null)[];
  currentTotal: number | null;
  arrears: number;
  lateAfterDue: number;
  arrearsLateFee: number;
  afterDueTotal: number | null;
  isVacant: boolean;
}

export interface AdjustmentStatementTotals {
  itemAmounts: number[];
  currentTotal: number;
  arrears: number;
  lateAfterDue: number;
  arrearsLateFee: number;
  afterDueTotal: number;
}

export interface AdjustmentStatementPageModel {
  buildingId: number;
  buildingCode: string;
  buildingName: string;
  companyName: string;
  year: string; // 'YYYY'
  month: string; // 'MM'
  outputDate: string;
  pageIndex: number; // 1-based
  pageCount: number;
  feeItemNames: string[];
  rows: AdjustmentStatementRow[];
  totals: AdjustmentStatementTotals;
}

function sortByUnitNo(a: string, b: string): number {
  return a.localeCompare(b, "ko-KR", { numeric: true });
}

export function buildAdjustmentStatementPages(
  params: BuildAdjustmentParams,
): AdjustmentStatementPageModel[] {
  const { period, companyName, outputDate, tiers } = params;
  const [year, month] = period.split("-");
  const asOfYear = Number(year);
  const asOfMonth = Number(month);
  const pageCount = params.buildings.length;

  return params.buildings.map((entry, index) => {
    // 부과 항목 컬럼 = 등록 항목 전체(부과 여부 무관). 순서는 sort_order(문서 items가 이미 정렬됨).
    const itemOrder: { id: number; name: string }[] = [];
    const itemSeen = new Set<number>();
    for (const document of entry.documents) {
      for (const item of document.items) {
        if (itemSeen.has(item.feeItemId)) continue;
        itemSeen.add(item.feeItemId);
        itemOrder.push({ id: item.feeItemId, name: item.name });
      }
    }
    const feeItemNames = itemOrder.map((item) => item.name);

    const documentByUnit = new Map(entry.documents.map((document) => [document.unitId, document]));
    const targetByUnit = new Map(entry.targets.map((target) => [target.unitId, target]));
    const overdueByUnit = new Map<number, AdjustmentOverdueInput[]>();
    for (const row of entry.overduePeriods) {
      const list = overdueByUnit.get(row.unitId);
      if (list) list.push(row);
      else overdueByUnit.set(row.unitId, [row]);
    }

    // 검침 종목 = 등록 항목 순서상 첫 계량(수도/전기/가스) 항목의 종목.
    let meterUtility: MeterUtility | null = null;
    for (const item of itemOrder) {
      const resolved = utilityForItemName(item.name);
      if (resolved) { meterUtility = resolved; break; }
    }
    const meterByUnit = new Map(
      (meterUtility ? entry.metersByUtility[meterUtility] : []).map((meter) => [meter.unitId, meter]),
    );

    // 세대 스파인 = 전 종목 검침(전 세대) ∪ 부과대상. 표기(호수/동)는 부과대상 우선.
    const allMeterRows = [
      ...entry.metersByUtility.water,
      ...entry.metersByUtility.electricity,
      ...entry.metersByUtility.gas,
    ];
    const unitMeta = new Map<number, { unitNo: string; dong: string | null; occupancyStatus: AdjustmentMeterInput["occupancyStatus"] }>();
    for (const meter of allMeterRows) {
      unitMeta.set(meter.unitId, { unitNo: meter.unitNo, dong: meter.dong, occupancyStatus: meter.occupancyStatus });
    }
    for (const target of entry.targets) {
      const previous = unitMeta.get(target.unitId);
      unitMeta.set(target.unitId, { unitNo: target.unitNo, dong: target.dong, occupancyStatus: previous?.occupancyStatus ?? null });
    }

    const unitIds = [...unitMeta.keys()].sort((a, b) =>
      sortByUnitNo(unitMeta.get(a)!.unitNo, unitMeta.get(b)!.unitNo),
    );

    const totals: AdjustmentStatementTotals = {
      itemAmounts: itemOrder.map(() => 0),
      currentTotal: 0,
      arrears: 0,
      lateAfterDue: 0,
      arrearsLateFee: 0,
      afterDueTotal: 0,
    };

    const rows = unitIds.map((unitId) => {
      const meta = unitMeta.get(unitId)!;
      const target = targetByUnit.get(unitId);
      const document = documentByUnit.get(unitId);
      const meter = meterByUnit.get(unitId);
      const overdue = overdueByUnit.get(unitId) ?? [];

      const chargedItems = new Map<number, number>();
      for (const item of document?.items ?? []) {
        if (item.charged) chargedItems.set(item.feeItemId, item.amount);
      }
      const hasBilling = chargedItems.size > 0;
      const isVacant = !hasBilling && (meta.occupancyStatus === "vacant" || !target);

      const itemAmounts = itemOrder.map((item) =>
        chargedItems.has(item.id) ? (chargedItems.get(item.id) as number) : hasBilling ? 0 : null,
      );
      const currentTotal = document ? giroDocumentAmount(document) : hasBilling ? 0 : null;

      // ── 미납·연체 매핑 (정본 /overdue 엔진) ───────────────────────────────
      const priorInputs: OverduePeriodInput[] = overdue
        .filter((row) => row.period < period)
        .map((row) => ({ period: row.period, unpaidPrincipal: row.unpaidPrincipal, dueDate: row.dueDate }));
      const currentRow = overdue.find((row) => row.period === period);

      // 미납액 = 전월까지 미납 원금 합계
      const arrears = priorInputs.reduce((sum, row) => sum + row.unpaidPrincipal, 0);
      // 미납연체료 = 미납 원금에 대한 누적 연체료
      const arrearsLateFee = computeLateFee(priorInputs, tiers, asOfYear, asOfMonth).totalLateFee;
      // 납기후연체 = 당월분을 납기 후 납부 시 가산되는 연체료
      const lateAfterDue = currentRow
        ? computeLateFeeForPeriod(
            { period: currentRow.period, unpaidPrincipal: currentRow.unpaidPrincipal, dueDate: currentRow.dueDate },
            tiers,
            asOfYear,
            asOfMonth,
          ).postDueFee
        : 0;
      // 납기후금액 = 당월계 + 납기후연체 (납기 후 당월 청구액)
      const afterDueTotal = currentTotal === null ? null : currentTotal + lateAfterDue;
      // ──────────────────────────────────────────────────────────────────

      itemAmounts.forEach((amount, position) => {
        if (amount) totals.itemAmounts[position] += amount;
      });
      totals.currentTotal += currentTotal ?? 0;
      totals.arrears += arrears;
      totals.lateAfterDue += lateAfterDue;
      totals.arrearsLateFee += arrearsLateFee;
      totals.afterDueTotal += afterDueTotal ?? 0;

      const name = target?.payerName?.trim() || target?.tenantName?.trim() || "";

      return {
        unitId,
        unitNo: meta.unitNo,
        dong: meta.dong,
        name,
        phone: target?.phone ?? null,
        paidDate: entry.paidDateByUnit.get(unitId) ?? null,
        meter: {
          current: meter?.currentReading ?? null,
          previous: meter?.previousReading ?? null,
          usage: meter?.usage ?? null,
        },
        itemAmounts,
        currentTotal,
        arrears,
        lateAfterDue,
        arrearsLateFee,
        afterDueTotal,
        isVacant,
      } satisfies AdjustmentStatementRow;
    });

    return {
      buildingId: entry.building.id,
      buildingCode: entry.building.code,
      buildingName: entry.building.name,
      companyName,
      year,
      month,
      outputDate,
      pageIndex: index + 1,
      pageCount,
      feeItemNames,
      rows,
      totals,
    } satisfies AdjustmentStatementPageModel;
  });
}
