import { useQueries } from "@tanstack/react-query";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  getBillingPeriodSetting,
  listBilling,
  type BillingPeriodSetting,
} from "@/hooks/reactquery/billing";
import {
  listOverdueHouseholds,
  type OverdueHousehold,
} from "@/hooks/reactquery/overdue";
import {
  listPaymentRows,
  type PaymentRow,
} from "@/hooks/reactquery/payments";
import type { BillingFlatRow } from "@/lib/billing/pivot";

type ReceiptBuilding = Pick<Building, "id" | "name">;

interface ReceiptBuildingStatus {
  building: ReceiptBuilding;
  paymentRows: PaymentRow[];
  billingRows: BillingFlatRow[];
  periodSetting: BillingPeriodSetting;
  overdueHouseholds: OverdueHousehold[];
}

export interface ReceiptPaymentRow extends PaymentRow {
  buildingId: number;
  buildingName: string;
  phone: string | null;
  overdueMonths: number;
  lastPaymentDate: string | null;
}

export interface ReceiptFeeItemAmount {
  buildingId: number;
  buildingName: string;
  feeItemId: number;
  feeItemName: string;
  amount: number;
}

export interface ReceiptPaymentStatusData {
  rows: ReceiptPaymentRow[];
  feeItems: ReceiptFeeItemAmount[];
}

export function combineReceiptBuildingStatuses(
  statuses: ReceiptBuildingStatus[],
): ReceiptPaymentStatusData {
  const rows: ReceiptPaymentRow[] = [];
  const feeItemAmounts = new Map<string, ReceiptFeeItemAmount>();

  for (const status of statuses) {
    const overdueByUnit = new Map(
      status.overdueHouseholds.map((household) => [household.unitId, household]),
    );

    for (const payment of status.paymentRows) {
      const overdue = overdueByUnit.get(payment.unitId);
      rows.push({
        ...payment,
        buildingId: status.building.id,
        buildingName: status.building.name,
        dueDate: payment.dueDate ?? status.periodSetting.dueDate,
        phone: overdue?.phone ?? null,
        overdueMonths: overdue?.overdueMonths ?? 0,
        lastPaymentDate: overdue?.lastPaymentDate ?? null,
      });
    }

    for (const billing of status.billingRows) {
      if (!billing.charged) continue;
      const key = `${status.building.id}:${billing.feeItemId}`;
      const current = feeItemAmounts.get(key);
      if (current) {
        current.amount += billing.amount;
      } else {
        feeItemAmounts.set(key, {
          buildingId: status.building.id,
          buildingName: status.building.name,
          feeItemId: billing.feeItemId,
          feeItemName: billing.feeItemName,
          amount: billing.amount,
        });
      }
    }
  }

  return {
    rows,
    feeItems: [...feeItemAmounts.values()],
  };
}

async function loadReceiptBuildingStatus(
  building: ReceiptBuilding,
  period: string,
): Promise<ReceiptBuildingStatus> {
  const [paymentRows, billingRows, periodSetting, overdueHouseholds] = await Promise.all([
    listPaymentRows(building.id, period),
    listBilling(building.id, period),
    getBillingPeriodSetting(building.id, period),
    listOverdueHouseholds(building.id, {
      year: Number(period.slice(0, 4)),
      month: Number(period.slice(5, 7)),
      scope: "current",
    }),
  ]);

  return {
    building,
    paymentRows,
    billingRows,
    periodSetting,
    overdueHouseholds,
  };
}

export function useReceiptPaymentStatus(
  buildings: ReceiptBuilding[],
  period: string,
  enabled = true,
) {
  const queries = useQueries({
    queries: buildings.map((building) => ({
      queryKey: ["receipts", "payment-status", building.id, period] as const,
      queryFn: () => loadReceiptBuildingStatus(building, period),
      enabled: enabled && Boolean(period),
    })),
  });

  return {
    data: combineReceiptBuildingStatuses(
      queries.flatMap((query) => (query.data ? [query.data] : [])),
    ),
    isLoading: queries.some((query) => query.isLoading),
    isError: queries.some((query) => query.isError),
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
  };
}
