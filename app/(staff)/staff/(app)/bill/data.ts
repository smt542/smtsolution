import "server-only";

import { printableAccounts, PROGRAM_COMPANY_NAME } from "@/lib/bill/document";
import { createClient } from "@/lib/supabase/server";
import type { BillBuilding, BillPageData } from "./types";

type BillBuildingRow = Omit<BillBuilding, "basicExtra"> & {
  basic_extra: { groupType?: string | null } | null;
};

type BillSetupConfigRow = {
  customer_notice: string | null;
  mgmt_bank1: string | null;
  mgmt_acct1: string | null;
  mgmt_holder1: string | null;
  mgmt_print1: boolean;
  mgmt_bank2: string | null;
  mgmt_acct2: string | null;
  mgmt_holder2: string | null;
  mgmt_print2: boolean;
};

export async function getBillPageData(orgId: number): Promise<BillPageData> {
  const supabase = await createClient();
  const [buildingsResult, organizationResult, configResult] = await Promise.all([
    supabase
      .from("buildings")
      .select("id, code, name, address, basic_extra")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle(),
    supabase
      .from("setup_config")
      .select("customer_notice, mgmt_bank1, mgmt_acct1, mgmt_holder1, mgmt_print1, mgmt_bank2, mgmt_acct2, mgmt_holder2, mgmt_print2")
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  if (buildingsResult.error) throw new Error(buildingsResult.error.message);
  if (organizationResult.error) throw new Error(organizationResult.error.message);
  if (configResult.error) throw new Error(configResult.error.message);

  const config = configResult.data as BillSetupConfigRow | null;

  return {
    orgId,
    buildings: ((buildingsResult.data ?? []) as BillBuildingRow[]).map(({ basic_extra, ...building }) => ({
      ...building,
      basicExtra: basic_extra ? { groupType: basic_extra.groupType ?? null } : null,
    })),
    companyName: organizationResult.data?.name ?? PROGRAM_COMPANY_NAME,
    accounts: printableAccounts(config ? {
      mgmtBank1: config.mgmt_bank1,
      mgmtAcct1: config.mgmt_acct1,
      mgmtHolder1: config.mgmt_holder1,
      mgmtPrint1: config.mgmt_print1,
      mgmtBank2: config.mgmt_bank2,
      mgmtAcct2: config.mgmt_acct2,
      mgmtHolder2: config.mgmt_holder2,
      mgmtPrint2: config.mgmt_print2,
    } : null),
    customerNotice: config?.customer_notice ?? null,
  };
}
