import { createClient } from "@/lib/supabase/client";
export interface LeaseContract {
  id: number; occupancyId: number;
  deposit: number | null; monthlyRent: number | null;
  startDate: string | null; endDate: string | null; expiryAlert: boolean;
  leaseType: string | null; depositDate: string | null; jeonseDeposit: number | null; bankAccount: string | null;
}
export const toLease = (r: {
  id: number; occupancy_id: number; deposit: number | null; monthly_rent: number | null;
  start_date: string | null; end_date: string | null; expiry_alert: boolean;
  lease_type?: string | null; deposit_date?: string | null; jeonse_deposit?: number | null; bank_account?: string | null;
}): LeaseContract =>
  ({
    id: r.id, occupancyId: r.occupancy_id, deposit: r.deposit, monthlyRent: r.monthly_rent,
    startDate: r.start_date, endDate: r.end_date, expiryAlert: r.expiry_alert,
    leaseType: r.lease_type ?? null, depositDate: r.deposit_date ?? null,
    jeonseDeposit: r.jeonse_deposit ?? null, bankAccount: r.bank_account ?? null,
  });
export async function getLeaseByOccupancy(occupancyId: number): Promise<LeaseContract | null> {
  const { data, error } = await createClient().from("lease_contracts").select("*").eq("occupancy_id", occupancyId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toLease(data) : null;
}
