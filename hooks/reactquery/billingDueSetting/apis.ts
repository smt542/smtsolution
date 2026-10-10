import { createClient } from "@/lib/supabase/client";

/** 관리회사 기본 납부기한(셋업 > 고지서 설정). monthOffset 0=당월·1=익월, dueDay 31=말일. */
export interface BillingDueSetting {
  monthOffset: 0 | 1;
  dueDay: number;
}

type Row = { month_offset: number; due_day: number };

/** 설정이 없으면 null — 시스템은 그 달 말일로 처리한다. */
export async function getBillingDueSetting(orgId: number): Promise<BillingDueSetting | null> {
  const { data, error } = await createClient()
    .from("org_billing_due_settings")
    .select("month_offset, due_day")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as Row | null;
  return row ? { monthOffset: row.month_offset === 1 ? 1 : 0, dueDay: row.due_day } : null;
}

/** null 이면 설정을 지워 「그 달 말일」 기본으로 되돌린다. */
export async function saveBillingDueSetting(orgId: number, setting: BillingDueSetting | null): Promise<void> {
  const client = createClient();
  if (setting === null) {
    const { error } = await client.from("org_billing_due_settings").delete().eq("org_id", orgId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await client
    .from("org_billing_due_settings")
    .upsert({ org_id: orgId, month_offset: setting.monthOffset, due_day: setting.dueDay }, { onConflict: "org_id" });
  if (error) throw new Error(error.message);
}
