import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { getSetupConfig, upsertSetupConfig } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("setupConfig apis", () => {
  it("getSetupConfig: 행 없으면 null", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    from.mockReturnValue({ select: () => ({ maybeSingle }) });
    expect(await getSetupConfig()).toBeNull();
  });

  it("getSetupConfig: snake→camel(불리언·계좌·enum)", async () => {
    const row = { org_id:9, customer_notice:"안내", unit_label_default:"name", late_fee_merge:true,
      print_utility_cutoff:false, print_water_unit_price:true, print_billing_period:false, print_delta:true,
      show_as_on_main:true, cutoff_months:3, mgmt_bank1:"국민", mgmt_acct1:"111", mgmt_holder1:"홍길동",
      mgmt_print1:true, mgmt_bank2:null, mgmt_acct2:null, mgmt_holder2:null, mgmt_print2:false,
      settle_bank:"신한", settle_acct:"222", settle_holder:"관리단", water_unit_reflect:true,
      electric_unit_reflect:false, vacancy_payment_mode:"auto" };
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    from.mockReturnValue({ select: () => ({ maybeSingle }) });
    const c = await getSetupConfig();
    expect(c).toMatchObject({ orgId:9, unitLabelDefault:"name", lateFeeMerge:true, printWaterUnitPrice:true,
      cutoffMonths:3, mgmtBank1:"국민", mgmtPrint2:false, settleHolder:"관리단", vacancyPaymentMode:"auto" });
  });

  it("upsertSetupConfig: org_id + 제공 필드만 + onConflict org_id", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ org_id:9, unit_label_default:"code" }, error:null });
    const sel = vi.fn(() => ({ single }));
    const ups = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ upsert: ups });
    await upsertSetupConfig(9, { customerNotice:"x", mgmtPrint1:false });
    expect(ups).toHaveBeenCalledWith(
      expect.objectContaining({ org_id:9, customer_notice:"x", mgmt_print1:false }),
      { onConflict: "org_id" }
    );
    // 제공 안 한 필드는 빠져야
    expect(ups.mock.calls[0][0]).not.toHaveProperty("cutoff_months");
  });
});
