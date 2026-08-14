import { createClient } from "@/lib/supabase/client";
export type AccountKind = "water" | "elec" | "gas" | "mgmt";
export interface UnitAccount { id: number; unitId: number; kind: AccountKind; bank: string | null; account: string | null; holder: string | null; cmsMemberNo: string | null; payerNo: string | null; }
export const toUnitAccount = (r: { id:number; unit_id:number; kind:AccountKind; bank:string|null; account:string|null; holder:string|null; cms_member_no:string|null; payer_no:string|null }): UnitAccount =>
  ({ id: r.id, unitId: r.unit_id, kind: r.kind, bank: r.bank, account: r.account, holder: r.holder, cmsMemberNo: r.cms_member_no, payerNo: r.payer_no });
export async function listAccountsByUnit(unitId: number): Promise<UnitAccount[]> {
  const { data, error } = await createClient().from("unit_accounts").select("*").eq("unit_id", unitId).order("kind");
  if (error) throw new Error(error.message);
  return (data ?? []).map(toUnitAccount);
}
