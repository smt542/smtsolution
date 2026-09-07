import { createClient } from "@/lib/supabase/client";

export type ResidentTransferMethod =
  | "giro"
  | "transfer"
  | "auto_transfer"
  | "deposit"
  | "none";
export type ResidentBillDelivery = "post" | "alimtalk";

export interface ResidentProfileRow {
  tenant_name: string;
  kakao_name: string | null;
  phone: string;
  building_name: string;
  unit_no: string;
  move_in_date: string;
  org_id: number;
  org_name: string;
  transfer_method: ResidentTransferMethod;
  bill_delivery: ResidentBillDelivery;
  alimtalk_opt_in: boolean;
  sms_opt_in: boolean;
  linked_at: string;
}

export interface ResidentProfile {
  tenantName: string;
  kakaoName: string | null;
  phone: string;
  buildingName: string;
  unitNo: string;
  moveInDate: string;
  orgId: number;
  orgName: string;
  transferMethod: ResidentTransferMethod;
  billDelivery: ResidentBillDelivery;
  alimtalkOptIn: boolean;
  smsOptIn: boolean;
  linkedAt: string;
}

export interface ResidentNotifyPrefsInput {
  alimtalk?: boolean | null;
  sms?: boolean | null;
}

export type ResidentProfileResult = ResidentProfile | null;

const rowToProfile = (row: ResidentProfileRow): ResidentProfile => ({
  tenantName: row.tenant_name,
  kakaoName: row.kakao_name,
  phone: row.phone,
  buildingName: row.building_name,
  unitNo: row.unit_no,
  moveInDate: row.move_in_date,
  orgId: row.org_id,
  orgName: row.org_name,
  transferMethod: row.transfer_method,
  billDelivery: row.bill_delivery,
  alimtalkOptIn: row.alimtalk_opt_in,
  smsOptIn: row.sms_opt_in,
  linkedAt: row.linked_at,
});

export async function residentGetProfile(): Promise<ResidentProfileResult> {
  const { data, error } = await createClient().rpc("resident_get_profile");
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as ResidentProfileRow[])[0];
  return row ? rowToProfile(row) : null;
}

export async function residentSetNotifyPrefs(
  args: ResidentNotifyPrefsInput,
): Promise<void> {
  const { error } = await createClient().rpc("resident_set_notify_prefs", {
    p_alimtalk: args.alimtalk ?? null,
    p_sms: args.sms ?? null,
  });
  if (error) throw new Error(error.message);
}
