import { useQueries, useQuery } from "@tanstack/react-query";
import {
  buildAdjustmentStatementPages,
  type AdjustmentBuildingInput,
  type AdjustmentDocumentInput,
  type AdjustmentStatementPageModel,
} from "@/lib/bill/adjustmentStatement";
import { listBilling } from "@/hooks/reactquery/billing/apis";
import { billingKeys } from "@/hooks/reactquery/billing/keys";
import { listLateFeeRateTiers } from "@/hooks/reactquery/lateFeeTiers/apis";
import { lateFeeTierKeys } from "@/hooks/reactquery/lateFeeTiers/keys";
import { listOverduePeriods } from "@/hooks/reactquery/overdue/apis";
import { useLateFeeDisabledOccupancies } from "@/hooks/reactquery/occupancies/queries";
import { useLateFeeSettings } from "@/hooks/reactquery/setupConfig/queries";
import { overdueKeys } from "@/hooks/reactquery/overdue/keys";
import { listBuildingPaymentDates } from "@/hooks/reactquery/payments/apis";
import { paymentKeys } from "@/hooks/reactquery/payments/keys";
import { listUtilityRows, type UtilityType, type UtilityUnitRow } from "@/hooks/reactquery/utilities/apis";
import { utilityKeys } from "@/hooks/reactquery/utilities/keys";
import type { BillingFlatRow } from "@/lib/billing/pivot";
import { listBillTargets } from "./apis";
import { billKeys } from "./keys";

// 검침 조회 종목 순서(빌더가 항목 순서로 표시 종목을 고르므로 3종목 모두 조회한다).
const METER_UTILITIES: UtilityType[] = ["water", "electricity", "gas"];

function toMeterInputs(rows: UtilityUnitRow[]) {
  return rows.map((meter) => ({
    unitId: meter.unitId,
    unitNo: meter.unitNo,
    dong: meter.dong,
    currentReading: meter.currentReading,
    previousReading: meter.previousReading,
    usage: meter.usage,
    occupancyStatus: meter.occupancyStatus,
  }));
}

// list_billing(모든 등록 fee_item × 세대) → 확정 세대별 문서. 항목은 sort_order 순으로
// 전 등록 항목을 담는다(부과 여부는 charged 플래그로 구분). 당월계는 확정 total_amount.
function toDocuments(rows: BillingFlatRow[]): AdjustmentDocumentInput[] {
  const byUnit = new Map<number, BillingFlatRow[]>();
  for (const row of rows) {
    if (row.confirmedAt == null) continue; // 확정 세대만
    const list = byUnit.get(row.unitId);
    if (list) list.push(row);
    else byUnit.set(row.unitId, [row]);
  }
  return [...byUnit.entries()].map(([unitId, unitRows]) => {
    const sorted = [...unitRows].sort((a, b) => a.sortOrder - b.sortOrder || a.feeItemId - b.feeItemId);
    return {
      unitId,
      totalAmount: sorted[0]?.totalAmount ?? 0,
      items: sorted.map((row) => ({ feeItemId: row.feeItemId, name: row.feeItemName, charged: row.charged, amount: row.amount })),
    };
  });
}

// 등록 항목 전체(확정 여부 무관). list_billing은 세대 × 항목 전체를 내려주므로 확정 전 월분에도 헤더가 채워진다.
function toFeeItems(rows: BillingFlatRow[]): { id: number; name: string }[] {
  const byId = new Map<number, { id: number; name: string; sortOrder: number }>();
  for (const row of rows) {
    if (!byId.has(row.feeItemId)) byId.set(row.feeItemId, { id: row.feeItemId, name: row.feeItemName, sortOrder: row.sortOrder });
  }
  return [...byId.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map(({ id, name }) => ({ id, name }));
}

export interface AdjustmentStatementBuilding {
  id: number;
  code: string;
  name: string;
  address: string | null;
}

export interface UseAdjustmentStatementsParams {
  buildings: AdjustmentStatementBuilding[];
  period: string; // 'YYYY-MM-01'
  orgId: number;
  companyName: string;
  outputDate: string;
  enabled: boolean;
}

export interface UseAdjustmentStatementsResult {
  pages: AdjustmentStatementPageModel[];
  isLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  hasData: boolean;
}

/** 조정명세서 미리보기·인쇄용 페이지 모델을 건물별 정본 소스에서 조립한다.
 *  targets/documents는 지로와 동일한 query key를 재사용하므로 캐시가 공유된다. */
export function useAdjustmentStatements(
  params: UseAdjustmentStatementsParams,
): UseAdjustmentStatementsResult {
  const { buildings, period, orgId, companyName, outputDate, enabled } = params;
  const [yearStr, monthStr] = period.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  const targetQueries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: billKeys.targets(building.id, period),
      queryFn: () => listBillTargets(building.id, period),
      enabled,
    })),
  });

  const billingQueries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: billingKeys.list(building.id, period),
      queryFn: () => listBilling(building.id, period),
      enabled,
    })),
  });

  const meterQueries = useQueries({
    queries: buildings.flatMap((building) =>
      METER_UTILITIES.map((utility) => ({
        queryKey: utilityKeys.rows(building.id, utility, period),
        queryFn: () => listUtilityRows(building.id, utility, period),
        enabled,
      })),
    ),
  });

  const overdueQueries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: overdueKeys.periods(building.id, year, month, "all"),
      queryFn: () => listOverduePeriods(building.id, { year, month, scope: "all" as const }),
      enabled,
    })),
  });

  const paymentQueries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: paymentKeys.statementDates(building.id, period, period),
      queryFn: () => listBuildingPaymentDates(building.id, period, period),
      enabled,
    })),
  });

  const tiersQuery = useQuery({
    queryKey: lateFeeTierKeys.list(orgId),
    queryFn: () => listLateFeeRateTiers(orgId),
    enabled: enabled && orgId > 0,
  });
  const lateFeeSettings = useLateFeeSettings(enabled && orgId > 0 ? orgId : null);
  const lateFeeDisabledOccupancies = useLateFeeDisabledOccupancies(enabled && orgId > 0 ? orgId : null);

  const buildingInputs: AdjustmentBuildingInput[] = buildings.map((building, index) => {
    const paidDateByUnit = new Map<number, string>();
    // 오름차순(paid_at)으로 정렬되어 오므로 마지막 값이 max(paid_at)로 남는다.
    for (const row of paymentQueries[index]?.data ?? []) paidDateByUnit.set(row.unitId, row.paidAt);

    return {
      building,
      targets: (targetQueries[index]?.data ?? []).map((target) => ({
        unitId: target.unitId,
        unitNo: target.unitNo,
        dong: target.dong,
        payerName: target.payerName,
        tenantName: target.tenantName,
        phone: target.phone,
      })),
      feeItems: toFeeItems(billingQueries[index]?.data ?? []),
      documents: toDocuments(billingQueries[index]?.data ?? []),
      metersByUtility: {
        water: toMeterInputs(meterQueries[index * 3]?.data ?? []),
        electricity: toMeterInputs(meterQueries[index * 3 + 1]?.data ?? []),
        gas: toMeterInputs(meterQueries[index * 3 + 2]?.data ?? []),
      },
      overduePeriods: (overdueQueries[index]?.data ?? []).map((row) => ({
        unitId: row.unitId,
        period: row.period,
        unpaidPrincipal: row.unpaidPrincipal,
        dueDate: row.dueDate,
        lateFeeEnabled: !lateFeeDisabledOccupancies.has(row.occupancyId),
      })),
      paidDateByUnit,
    };
  });

  const pages = enabled
    ? buildAdjustmentStatementPages({
        buildings: buildingInputs,
        period,
        companyName,
        outputDate,
        tiers: tiersQuery.data ?? [],
        lateFeeSettings,
      })
    : [];

  const perBuilding = [
    ...targetQueries,
    ...billingQueries,
    ...meterQueries,
    ...overdueQueries,
    ...paymentQueries,
  ];
  const allQueries = [...perBuilding, tiersQuery];

  return {
    pages,
    isLoading: enabled && allQueries.some((query) => query.isLoading),
    isRefreshing: enabled && allQueries.some((query) => query.isFetching && !query.isLoading),
    isError: enabled && allQueries.some((query) => query.isError),
    hasData: pages.some((page) => page.rows.length > 0),
  };
}
