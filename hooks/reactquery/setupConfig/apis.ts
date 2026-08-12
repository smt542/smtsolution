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
}
export type SetupConfigPatch = Partial<Omit<SetupConfig, "orgId">>;

const rowToConfig = (r: any): SetupConfig => ({
  orgId: r.org_id, customerNotice: r.customer_notice, unitLabelDefault: r.unit_label_default,
  lateFeeMerge: r.late_fee_merge, printUtilityCutoff: r.print_utility_cutoff,
  printWaterUnitPrice: r.print_water_unit_price, printBillingPeriod: r.print_billing_period,
  printDelta: r.print_delta, showAsOnMain: r.show_as_on_main, cutoffMonths: r.cutoff_months,
  mgmtBank1: r.mgmt_bank1, mgmtAcct1: r.mgmt_acct1, mgmtHolder1: r.mgmt_holder1, mgmtPrint1: r.mgmt_print1,
  mgmtBank2: r.mgmt_bank2, mgmtAcct2: r.mgmt_acct2, mgmtHolder2: r.mgmt_holder2, mgmtPrint2: r.mgmt_print2,
  settleBank: r.settle_bank, settleAcct: r.settle_acct, settleHolder: r.settle_holder,
  waterUnitReflect: r.water_unit_reflect, electricUnitReflect: r.electric_unit_reflect,
  vacancyPaymentMode: r.vacancy_payment_mode,
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
