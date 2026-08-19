import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  approveResidentClaim: vi.fn(),
  listResidentClaims: vi.fn(),
  rejectResidentClaim: vi.fn(),
  residentAutomatch: vi.fn(),
  residentConfirm: vi.fn(),
  residentMyLink: vi.fn(),
  residentRequestClaim: vi.fn(),
  stubResidentKakaoLogin: vi.fn(),
}));

vi.mock("./apis", () => api);

import {
  useApproveResidentClaim,
  useResidentAutomatch,
  useResidentConfirm,
  useResidentClaims,
} from "./index";

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resident claim hooks", () => {
  it("loads resident automatch candidates and staff claims", async () => {
    api.residentAutomatch.mockResolvedValue([{ occupancyId: 4 }]);
    api.listResidentClaims.mockResolvedValue([{ claimId: 5, status: "pending" }]);
    const { wrapper } = setup();

    const matches = renderHook(() => useResidentAutomatch(), { wrapper });
    const claims = renderHook(() => useResidentClaims("pending"), { wrapper });

    await waitFor(() => expect(matches.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(claims.result.current.isSuccess).toBe(true));
    expect(matches.result.current.data).toEqual([{ occupancyId: 4 }]);
    expect(api.listResidentClaims).toHaveBeenCalledWith("pending");
  });

  it("runs resident and staff mutations and invalidates resident claim data", async () => {
    api.residentConfirm.mockResolvedValue(undefined);
    api.approveResidentClaim.mockResolvedValue(undefined);
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const confirm = renderHook(() => useResidentConfirm(), { wrapper });
    const approve = renderHook(() => useApproveResidentClaim(), { wrapper });

    await confirm.result.current.mutateAsync(4);
    await approve.result.current.mutateAsync({ claimId: 5, occupancyId: 4 });

    expect(api.residentConfirm).toHaveBeenCalledWith(4);
    expect(api.approveResidentClaim).toHaveBeenCalledWith({ claimId: 5, occupancyId: 4 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["residentClaims"] });
  });
});
