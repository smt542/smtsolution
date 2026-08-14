// hooks/reactquery/buildingCustomerNumbers/apis.ts
import { createClient } from "@/lib/supabase/client";

export type CustomerNumberKind = "water" | "common_elec" | "elec" | "gas";

export interface CustomerNumberFilters {
  buildingId?: number | null;
  kind?: CustomerNumberKind | null;
  q?: string;
}

export interface CustomerNumberLookupRow {
  id: number;
  buildingId: number;
  buildingName: string;
  kind: CustomerNumberKind;
  customerNo: string;
  meterDay: number | null;
  billingBasis: "prev" | "current";
  printOnBill: boolean;
  holderName: string | null;
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
  sortOrder: number;
}

type BuildingCustomerNumberRow = {
  id: number; building_id: number; kind: CustomerNumberKind; customer_no: string;
  meter_day: number | null; billing_basis: "prev" | "current"; print_on_bill: boolean;
  holder_name: string | null; sort_order: number;
};

type CustomerNumberDbRow = {
  id: number; building_id: number; kind: CustomerNumberKind; customer_no: string;
  meter_day: number | null; billing_basis: "prev" | "current"; print_on_bill: boolean;
  holder_name: string | null; buildings: { name: string } | null;
};

export const toCustomerNumber = (r: BuildingCustomerNumberRow): BuildingCustomerNumber => ({
  id: r.id, buildingId: r.building_id, kind: r.kind, customerNo: r.customer_no,
  meterDay: r.meter_day, billingBasis: r.billing_basis, printOnBill: r.print_on_bill,
  holderName: r.holder_name, sortOrder: r.sort_order,
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

export async function listCustomerNumbers(filters: CustomerNumberFilters): Promise<CustomerNumberLookupRow[]> {
  let query = createClient()
    .from("building_customer_numbers")
    .select("id, kind, customer_no, meter_day, billing_basis, print_on_bill, holder_name, building_id, buildings!inner(id, name)")
    .is("deleted_at", null);
  if (filters.buildingId != null) query = query.eq("building_id", filters.buildingId);
  if (filters.kind) query = query.eq("kind", filters.kind);
  const q = filters.q?.trim();
  if (q) query = query.or(`customer_no.ilike.%${q}%,holder_name.ilike.%${q}%`);
  const { data, error } = await query.order("building_id").order("sort_order");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as CustomerNumberDbRow[]).map((r) => ({
    id: r.id, buildingId: r.building_id, buildingName: r.buildings?.name ?? "",
    kind: r.kind, customerNo: r.customer_no, meterDay: r.meter_day,
    billingBasis: r.billing_basis, printOnBill: r.print_on_bill, holderName: r.holder_name,
  }));
}
