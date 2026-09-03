import { createClient } from "@/lib/supabase/client";

export interface SetupConfig {
  orgId: number;
  customerNotice: string | null;
  unitLabelDefault: "code" | "name";
  lateFeeMerge: boolean;
  printUtilityCutoff: boolean;
  printWaterUnitPrice: boolean;
  printBillingPeriod: boolean;
  printDelta: boolean;
  showAsOnMain: boolean;
  cutoffMonths: number | null;
  mgmtBank1: string | null; mgmtAcct1: string | null; mgmtHolder1: string | null; mgmtPrint1: boolean;
  mgmtBank2: string | null; mgmtAcct2: string | null; mgmtHolder2: string | null; mgmtPrint2: boolean;
  settleBank: string | null; settleAcct: string | null; settleHolder: string | null;
  waterUnitReflect: boolean;
  electricUnitReflect: boolean;
  vacancyPaymentMode: "manual" | "auto";
  // 회사 정보(관리업체 정보) — 0122
  companyName: string | null;
  companyPhone: string | null;
  companyFax: string | null;
  bizRegNo: string | null;
  ceoName: string | null;
  companyAddress: string | null;
  operatingHours: string | null;
  smsSender: string | null;
  faxSender: string | null;
  smsSenderVerifiedAt: string | null;
  faxSenderVerifiedAt: string | null;
  // 알림 설정 — 0122
  notifyMoveIn: boolean;
  notifyLeaseExpiry: boolean;
  leaseExpiryDays: number;
}
type ServerManagedSenderField =
  | "smsSender"
  | "faxSender"
  | "smsSenderVerifiedAt"
  | "faxSenderVerifiedAt";
export type SetupConfigPatch = Partial<Omit<SetupConfig, "orgId" | ServerManagedSenderField>>;

type SetupConfigRow = {
  org_id: number; customer_notice: string | null; unit_label_default: "code" | "name";
  late_fee_merge: boolean; print_utility_cutoff: boolean; print_water_unit_price: boolean;
  print_billing_period: boolean; print_delta: boolean; show_as_on_main: boolean; cutoff_months: number | null;
  mgmt_bank1: string | null; mgmt_acct1: string | null; mgmt_holder1: string | null; mgmt_print1: boolean;
  mgmt_bank2: string | null; mgmt_acct2: string | null; mgmt_holder2: string | null; mgmt_print2: boolean;
  settle_bank: string | null; settle_acct: string | null; settle_holder: string | null;
  water_unit_reflect: boolean; electric_unit_reflect: boolean; vacancy_payment_mode: "manual" | "auto";
  company_name: string | null; company_phone: string | null; company_fax: string | null;
  biz_reg_no: string | null; ceo_name: string | null; company_address: string | null;
  operating_hours: string | null;
  sms_sender: string | null; fax_sender: string | null;
  sms_sender_verified_at: string | null; fax_sender_verified_at: string | null;
  notify_move_in: boolean; notify_lease_expiry: boolean; lease_expiry_days: number;
};

const rowToConfig = (r: SetupConfigRow): SetupConfig => ({
  orgId: r.org_id, customerNotice: r.customer_notice, unitLabelDefault: r.unit_label_default,
  lateFeeMerge: r.late_fee_merge, printUtilityCutoff: r.print_utility_cutoff,
  printWaterUnitPrice: r.print_water_unit_price, printBillingPeriod: r.print_billing_period,
  printDelta: r.print_delta, showAsOnMain: r.show_as_on_main, cutoffMonths: r.cutoff_months,
  mgmtBank1: r.mgmt_bank1, mgmtAcct1: r.mgmt_acct1, mgmtHolder1: r.mgmt_holder1, mgmtPrint1: r.mgmt_print1,
  mgmtBank2: r.mgmt_bank2, mgmtAcct2: r.mgmt_acct2, mgmtHolder2: r.mgmt_holder2, mgmtPrint2: r.mgmt_print2,
  settleBank: r.settle_bank, settleAcct: r.settle_acct, settleHolder: r.settle_holder,
  waterUnitReflect: r.water_unit_reflect, electricUnitReflect: r.electric_unit_reflect,
  vacancyPaymentMode: r.vacancy_payment_mode,
  companyName: r.company_name, companyPhone: r.company_phone, companyFax: r.company_fax,
  bizRegNo: r.biz_reg_no, ceoName: r.ceo_name, companyAddress: r.company_address,
  operatingHours: r.operating_hours,
  smsSender: r.sms_sender, faxSender: r.fax_sender,
  smsSenderVerifiedAt: r.sms_sender_verified_at, faxSenderVerifiedAt: r.fax_sender_verified_at,
  notifyMoveIn: r.notify_move_in, notifyLeaseExpiry: r.notify_lease_expiry,
  leaseExpiryDays: r.lease_expiry_days,
});

const CAMEL_TO_SNAKE: Record<keyof SetupConfigPatch, string> = {
  customerNotice:"customer_notice", unitLabelDefault:"unit_label_default", lateFeeMerge:"late_fee_merge",
  printUtilityCutoff:"print_utility_cutoff", printWaterUnitPrice:"print_water_unit_price",
  printBillingPeriod:"print_billing_period", printDelta:"print_delta", showAsOnMain:"show_as_on_main",
  cutoffMonths:"cutoff_months", mgmtBank1:"mgmt_bank1", mgmtAcct1:"mgmt_acct1", mgmtHolder1:"mgmt_holder1",
  mgmtPrint1:"mgmt_print1", mgmtBank2:"mgmt_bank2", mgmtAcct2:"mgmt_acct2", mgmtHolder2:"mgmt_holder2",
  mgmtPrint2:"mgmt_print2", settleBank:"settle_bank", settleAcct:"settle_acct", settleHolder:"settle_holder",
  waterUnitReflect:"water_unit_reflect", electricUnitReflect:"electric_unit_reflect",
  vacancyPaymentMode:"vacancy_payment_mode",
  companyName:"company_name", companyPhone:"company_phone", companyFax:"company_fax",
  bizRegNo:"biz_reg_no", ceoName:"ceo_name", companyAddress:"company_address",
  operatingHours:"operating_hours", notifyMoveIn:"notify_move_in",
  notifyLeaseExpiry:"notify_lease_expiry", leaseExpiryDays:"lease_expiry_days",
};

function patchToRow(patch: SetupConfigPatch): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const k of Object.keys(patch) as (keyof SetupConfigPatch)[]) {
    if (patch[k] !== undefined) r[CAMEL_TO_SNAKE[k]] = patch[k];
  }
  return r;
}

export async function getSetupConfig(orgId: number): Promise<SetupConfig | null> {
  const { data, error } = await createClient().from("setup_config").select("*").eq("org_id", orgId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToConfig(data) : null;
}

export async function upsertSetupConfig(orgId: number, patch: SetupConfigPatch): Promise<SetupConfig> {
  const { data, error } = await createClient()
    .from("setup_config")
    .upsert({ org_id: orgId, ...patchToRow(patch) }, { onConflict: "org_id" })
    .select().single();
  if (error) throw new Error(error.message);
  return rowToConfig(data);
}

export type SetupSenderProduct = "sms" | "fax";
export interface SaveSetupSenderResult {
  product: SetupSenderProduct;
  number: string | null;
  verifiedAt: string | null;
}

export async function saveSetupSender(
  product: SetupSenderProduct,
  number: string,
): Promise<SaveSetupSenderResult> {
  const response = await fetch("/api/setup/sender", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product, number }),
  });
  const result = (await response.json().catch(() => ({}))) as SaveSetupSenderResult & {
    error?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new Error(result.message ?? result.error ?? "발신번호를 저장하지 못했습니다.");
  }
  return result;
}
