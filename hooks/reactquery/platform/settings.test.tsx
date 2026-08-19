import React from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from, rpc }),
}));

import {
  getPlatformSettings,
  updatePlatformSettings,
  useUpdatePlatformSettings,
  type PlatformSettingsInput,
} from "./settings";
import { platformKeys } from "./keys";

const row = {
  id: 1,
  rate_krw_alimtalk: 8,
  rate_krw_sms: 12,
  rate_krw_fax: 45,
  low_balance_threshold: 1000,
  billing_bank: "국민은행",
  billing_account_no: "123-456",
  billing_account_holder: "관리비서",
  business_reg_no: "123-45-67890",
  invoice_notice: "입금 후 연락해 주세요.",
  billing_basis: "월 사용량",
  payment_due_days: 7,
  vat_rate: "10.5",
  contact_person: "김담당",
  updated_by: "user-1",
  updated_at: "2026-08-19T00:00:00Z",
};

const input: PlatformSettingsInput = {
  rateKrwAlimtalk: 8,
  rateKrwSms: 12,
  rateKrwFax: 45,
  lowBalanceThreshold: 1000,
  billingBank: "국민은행",
  billingAccountNo: "123-456",
  billingAccountHolder: "관리비서",
  businessRegNo: "123-45-67890",
  invoiceNotice: "입금 후 연락해 주세요.",
  billingBasis: "월 사용량",
  paymentDueDays: 7,
  vatRate: 10.5,
  contactPerson: "김담당",
};

beforeEach(() => vi.clearAllMocks());

describe("platform settings", () => {
  it("싱글턴 설정을 조회해 camelCase로 변환한다", async () => {
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValue({ select });

    await expect(getPlatformSettings()).resolves.toEqual(expect.objectContaining({
      id: 1,
      rateKrwAlimtalk: 8,
      billingAccountNo: "123-456",
      vatRate: 10.5,
      updatedBy: "user-1",
    }));
    expect(from).toHaveBeenCalledWith("platform_settings");
    expect(eq).toHaveBeenCalledWith("id", 1);
  });

  it("저장 RPC에 모든 설정 값을 snake_case 파라미터로 전달한다", async () => {
    rpc.mockResolvedValue({ data: row, error: null });

    await expect(updatePlatformSettings(input)).resolves.toEqual(
      expect.objectContaining({ billingBasis: "월 사용량", vatRate: 10.5 }),
    );
    expect(rpc).toHaveBeenCalledWith("platform_update_settings", {
      p_rate_krw_alimtalk: 8,
      p_rate_krw_sms: 12,
      p_rate_krw_fax: 45,
      p_low_balance_threshold: 1000,
      p_billing_bank: "국민은행",
      p_billing_account_no: "123-456",
      p_billing_account_holder: "관리비서",
      p_business_reg_no: "123-45-67890",
      p_invoice_notice: "입금 후 연락해 주세요.",
      p_billing_basis: "월 사용량",
      p_payment_due_days: 7,
      p_vat_rate: 10.5,
      p_contact_person: "김담당",
    });
  });

  it("저장 성공 후 설정 쿼리를 갱신하고 무효화한다", async () => {
    rpc.mockResolvedValue({ data: row, error: null });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdatePlatformSettings(), { wrapper });

    await result.current.mutateAsync(input);

    expect(queryClient.getQueryData(platformKeys.settings())).toEqual(
      expect.objectContaining({ id: 1, contactPerson: "김담당" }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: platformKeys.settings() });
  });
});
