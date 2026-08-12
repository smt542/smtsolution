// hooks/reactquery/buildingCustomerNumbers/apis.ts
import { createClient } from "@/lib/supabase/client";

export type CustomerNumberKind = "water" | "common_elec" | "elec" | "gas";

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
