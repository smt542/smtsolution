import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { platformKeys } from "./keys";

export interface PlatformSettingsInput {
  rateKrwAlimtalk: number;
  rateKrwSms: number;
  rateKrwFax: number;
  lowBalanceThreshold: number;
  billingBank: string | null;
  billingAccountNo: string | null;
  billingAccountHolder: string | null;
  businessRegNo: string | null;
  invoiceNotice: string | null;
  billingBasis: string | null;
  paymentDueDays: number;
  vatRate: number;
  contactPerson: string | null;
}

export interface PlatformSettings extends PlatformSettingsInput {
  id: number;
  updatedBy: string | null;
  updatedAt: string;
}

interface PlatformSettingsRow {
  id: number;
  rate_krw_alimtalk: number;
  rate_krw_sms: number;
  rate_krw_fax: number;
  low_balance_threshold: number;
  billing_bank: string | null;
  billing_account_no: string | null;
  billing_account_holder: string | null;
  business_reg_no: string | null;
  invoice_notice: string | null;
  billing_basis: string | null;
  payment_due_days: number;
  vat_rate: number | string;
  contact_person: string | null;
  updated_by: string | null;
  updated_at: string;
}

const SETTINGS_COLUMNS = [
  "id",
  "rate_krw_alimtalk",
  "rate_krw_sms",
  "rate_krw_fax",
  "low_balance_threshold",
  "billing_bank",
  "billing_account_no",
  "billing_account_holder",
  "business_reg_no",
  "invoice_notice",
  "billing_basis",
  "payment_due_days",
  "vat_rate",
  "contact_person",
  "updated_by",
  "updated_at",
].join(", ");

function mapSettings(row: PlatformSettingsRow): PlatformSettings {
  return {
    id: row.id,
    rateKrwAlimtalk: row.rate_krw_alimtalk,
    rateKrwSms: row.rate_krw_sms,
    rateKrwFax: row.rate_krw_fax,
    lowBalanceThreshold: row.low_balance_threshold,
    billingBank: row.billing_bank,
    billingAccountNo: row.billing_account_no,
    billingAccountHolder: row.billing_account_holder,
    businessRegNo: row.business_reg_no,
    invoiceNotice: row.invoice_notice,
    billingBasis: row.billing_basis,
    paymentDueDays: row.payment_due_days,
    vatRate: Number(row.vat_rate),
    contactPerson: row.contact_person,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await createClient()
    .from("platform_settings")
    .select(SETTINGS_COLUMNS)
    .eq("id", 1)
    .single();

  if (error) throw new Error(error.message);
  return mapSettings(data as unknown as PlatformSettingsRow);
}

export async function updatePlatformSettings(
  input: PlatformSettingsInput,
): Promise<PlatformSettings> {
  const { data, error } = await createClient().rpc("platform_update_settings", {
    p_rate_krw_alimtalk: input.rateKrwAlimtalk,
    p_rate_krw_sms: input.rateKrwSms,
    p_rate_krw_fax: input.rateKrwFax,
    p_low_balance_threshold: input.lowBalanceThreshold,
    p_billing_bank: input.billingBank,
    p_billing_account_no: input.billingAccountNo,
    p_billing_account_holder: input.billingAccountHolder,
    p_business_reg_no: input.businessRegNo,
    p_invoice_notice: input.invoiceNotice,
    p_billing_basis: input.billingBasis,
    p_payment_due_days: input.paymentDueDays,
    p_vat_rate: input.vatRate,
    p_contact_person: input.contactPerson,
  });

  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as unknown as PlatformSettingsRow | null;
  if (!row) throw new Error("설정 저장 결과를 확인하지 못했습니다.");
  return mapSettings(row);
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: platformKeys.settings(),
    queryFn: getPlatformSettings,
  });
}

export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePlatformSettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(platformKeys.settings(), settings);
      return queryClient.invalidateQueries({ queryKey: platformKeys.settings() });
    },
  });
}
