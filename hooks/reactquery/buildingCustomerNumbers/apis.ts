// hooks/reactquery/buildingCustomerNumbers/apis.ts
import { createClient } from "@/lib/supabase/client";

export type CustomerNumberKind = "water" | "common_elec" | "elec" | "gas";
export type CustomerNumberLookupKind = Extract<CustomerNumberKind, "water" | "common_elec">;
export type CustomerNumberCalculationMethod = "auto" | "manual";

export interface CustomerNumberFilters {
  kind: CustomerNumberLookupKind;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomerNumberLookupResult {
  rows: CustomerNumberLookupRow[];
  total: number;
}

export interface CustomerNumberLookupRow {
  id: number;
  buildingId: number;
  buildingCode: string;
  buildingName: string;
  address: string | null;
  kind: CustomerNumberLookupKind;
  customerNo: string;
  lineName: string | null;
  meterDay: number | null;
  billingBasis: "prev" | "current";
  calculationMethod: CustomerNumberCalculationMethod;
  note: string | null;
}

export interface BuildingCustomerNumber {
  id: number;
  buildingId: number;
  kind: CustomerNumberKind;
  customerNo: string;
  meterDay: number | null;
  billingBasis: "prev" | "current";
  printOnBill: boolean;
  holderName: string | null;
  lineName: string | null;
  calculationMethod: CustomerNumberCalculationMethod;
  note: string | null;
  sortOrder: number;
}

type BuildingCustomerNumberRow = {
  id: number; building_id: number; kind: CustomerNumberKind; customer_no: string;
  meter_day: number | null; billing_basis: "prev" | "current"; print_on_bill: boolean;
  holder_name: string | null; line_name?: string | null;
  calculation_method?: CustomerNumberCalculationMethod; note?: string | null; sort_order: number;
};

type CustomerNumberDbRow = {
  id: number; building_id: number; building_code: string; building_name: string;
  address: string | null; kind: CustomerNumberLookupKind; customer_no: string;
  line_name: string | null; meter_day: number | null; billing_basis: "prev" | "current";
  calculation_method: CustomerNumberCalculationMethod; note: string | null;
  sort_order: number; total_count: number;
};

export const toCustomerNumber = (r: BuildingCustomerNumberRow): BuildingCustomerNumber => ({
  id: r.id, buildingId: r.building_id, kind: r.kind, customerNo: r.customer_no,
  meterDay: r.meter_day, billingBasis: r.billing_basis, printOnBill: r.print_on_bill,
  holderName: r.holder_name, lineName: r.line_name ?? null,
  calculationMethod: r.calculation_method ?? "auto", note: r.note ?? null,
  sortOrder: r.sort_order,
});

export async function listCustomerNumbersByBuilding(buildingId: number): Promise<BuildingCustomerNumber[]> {
  const { data, error } = await createClient()
    .from("building_customer_numbers")
    .select("*")
    .eq("building_id", buildingId)
    .is("deleted_at", null)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toCustomerNumber);
}

/** 건물 목록 검침일 필터용: 건물별·항목별 대표 검침일(최소값) 맵. */
export type BuildingMeterDayMap = Record<number, Partial<Record<CustomerNumberKind, number>>>;

export async function listBuildingMeterDays(buildingIds: number[]): Promise<BuildingMeterDayMap> {
  if (buildingIds.length === 0) return {};
  const { data, error } = await createClient()
    .from("building_customer_numbers")
    .select("building_id, kind, meter_day")
    .in("building_id", buildingIds)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  const map: BuildingMeterDayMap = {};
  for (const r of (data ?? []) as { building_id: number; kind: CustomerNumberKind; meter_day: number | null }[]) {
    if (r.meter_day == null) continue;
    const byKind = (map[r.building_id] ??= {});
    const cur = byKind[r.kind];
    if (cur == null || r.meter_day < cur) byKind[r.kind] = r.meter_day;
  }
  return map;
}

export async function listCustomerNumbers(
  filters: CustomerNumberFilters,
): Promise<CustomerNumberLookupResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
  const q = filters.q?.trim();
  const { data, error } = await createClient().rpc("list_customer_number_lookup", {
    p_kind: filters.kind,
    p_query: q || null,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error(error.message);
  const dbRows = (data ?? []) as CustomerNumberDbRow[];
  return {
    rows: dbRows.map((r) => ({
      id: r.id, buildingId: r.building_id, buildingCode: r.building_code,
      buildingName: r.building_name, address: r.address, kind: r.kind,
      customerNo: r.customer_no, lineName: r.line_name, meterDay: r.meter_day,
      billingBasis: r.billing_basis, calculationMethod: r.calculation_method, note: r.note,
    })),
    total: Number(dbRows[0]?.total_count ?? 0),
  };
}
