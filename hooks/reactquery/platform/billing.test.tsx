import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc }),
}));

import {
  getPlatformOrgBilling,
  getPlatformOverviewMetrics,
  markOrgBillingPaid,
  useMarkOrgBillingPaid,
  usePlatformOrgBilling,
  usePlatformOverviewMetrics,
} from "./billing";
import { platformKeys } from "./keys";

const month = "2026-08-01";

beforeEach(() => vi.clearAllMocks());

describe("platform billing", () => {
  it("maps organization billing rows to camelCase", async () => {
    rpc.mockResolvedValue({
      data: [{
        org_id: 7,
        org_name: "Wolfeel Housing",
        org_email: "owner@example.com",
        status: "unpaid",
        alimtalk_count: 11,
        sms_count: 4,
        fax_count: 2,
        subtotal_krw: 510,
        vat_krw: 51,
        total_krw: 561,
        prev_total_krw: 440,
      }],
      error: null,
    });

    await expect(getPlatformOrgBilling(month)).resolves.toEqual([{
      orgId: 7,
      orgName: "Wolfeel Housing",
      orgEmail: "owner@example.com",
      status: "unpaid",
      alimtalkCount: 11,
      smsCount: 4,
      faxCount: 2,
      subtotalKrw: 510,
      vatKrw: 51,
      totalKrw: 561,
      prevTotalKrw: 440,
    }]);
    expect(rpc).toHaveBeenCalledWith("platform_list_org_billing", { p_month: month });
  });

  it("returns the single overview metrics row in camelCase", async () => {
    rpc.mockResolvedValue({
      data: [{
        org_active: 8,
        org_suspended: 2,
        org_terminated: 1,
        building_count: 30,
        building_added_this_month: 3,
        unit_count: 400,
        linked_unit_count: 275,
        send_cost_krw: 12345,
        send_cost_prev_krw: 11000,
      }],
      error: null,
    });

    await expect(getPlatformOverviewMetrics(month)).resolves.toEqual({
      orgActive: 8,
      orgSuspended: 2,
      orgTerminated: 1,
      buildingCount: 30,
      buildingAddedThisMonth: 3,
      unitCount: 400,
      linkedUnitCount: 275,
      sendCostKrw: 12345,
      sendCostPrevKrw: 11000,
    });
    expect(rpc).toHaveBeenCalledWith("platform_get_overview_metrics", { p_month: month });
  });

  it("stores both query-hook results under month-scoped keys", async () => {
    rpc.mockImplementation((name: string) => {
      if (name === "platform_list_org_billing") {
        return Promise.resolve({
          data: [{
            org_id: 7,
            org_name: "Wolfeel Housing",
            org_email: null,
            status: "none",
            alimtalk_count: 0,
            sms_count: 0,
            fax_count: 0,
            subtotal_krw: 0,
            vat_krw: 0,
            total_krw: 0,
            prev_total_krw: 0,
          }],
          error: null,
        });
      }
      return Promise.resolve({
        data: [{
          org_active: 1,
          org_suspended: 0,
          org_terminated: 0,
          building_count: 2,
          building_added_this_month: 1,
          unit_count: 20,
          linked_unit_count: 10,
          send_cost_krw: 0,
          send_cost_prev_krw: 0,
        }],
        error: null,
      });
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => ({
      billing: usePlatformOrgBilling(month),
      metrics: usePlatformOverviewMetrics(month),
    }), { wrapper });

    await waitFor(() => {
      expect(result.current.billing.isSuccess).toBe(true);
      expect(result.current.metrics.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(platformKeys.billing(month))).toEqual([
      expect.objectContaining({ orgId: 7, status: "none" }),
    ]);
    expect(queryClient.getQueryData(platformKeys.overviewMetrics(month))).toEqual(
      expect.objectContaining({ orgActive: 1, buildingCount: 2 }),
    );
  });

  it("calls the paid-state RPC and maps its snapshot", async () => {
    rpc.mockResolvedValue({
      data: {
        id: 3,
        org_id: 7,
        billing_month: month,
        status: "paid",
        alimtalk_count: 11,
        sms_count: 4,
        fax_count: 2,
        subtotal_krw: 510,
        vat_krw: 51,
        total_krw: 561,
        issued_at: "2026-08-19T00:00:00Z",
        paid_at: "2026-08-19T00:00:00Z",
        updated_by: "user-1",
        updated_at: "2026-08-19T00:00:00Z",
      },
      error: null,
    });

    await expect(markOrgBillingPaid({ orgId: 7, month, paid: true })).resolves.toEqual(
      expect.objectContaining({ id: 3, orgId: 7, status: "paid", totalKrw: 561 }),
    );
    expect(rpc).toHaveBeenCalledWith("platform_mark_org_billing_paid", {
      p_org_id: 7,
      p_month: month,
      p_paid: true,
    });
  });

  it("invalidates billing, both overview queries, and organizations", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useMarkOrgBillingPaid(), { wrapper });

    await result.current.mutateAsync({ orgId: 7, month, paid: false });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: platformKeys.billing(month) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: platformKeys.overviewMetrics(month) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: platformKeys.overview() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: platformKeys.organizations() });
  });

  it("surfaces Supabase RPC errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });

    await expect(getPlatformOrgBilling(month)).rejects.toThrow("forbidden");
  });
});
