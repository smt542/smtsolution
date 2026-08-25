import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./apis", () => ({
  listTenants: vi.fn(),
  getUnitOccupancyFull: vi.fn(),
  listOccupancies: vi.fn(),
}));

import { listTenants } from "./apis";
import { useOrganizationTenantList } from "./queries";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listTenants).mockImplementation(async (buildingId) => [{
    unitId: buildingId * 10,
    occupancyId: buildingId * 100,
    unitNo: `${buildingId}01호`,
    tenantName: `입주자 ${buildingId}`,
    phone: `010-0000-00${buildingId}`,
    roomTypeLabel: null,
    residentCount: 1,
    moveInDate: "2026-01-01",
    isVacant: false,
    isOverdue: false,
  }]);
});

describe("useOrganizationTenantList", () => {
  it("중복 건물 id를 제거하고 기존 건물별 tenant query 결과를 합친다", async () => {
    const { result } = renderHook(
      () => useOrganizationTenantList([11, 12, 11]),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listTenants).toHaveBeenCalledTimes(2);
    expect(listTenants).toHaveBeenCalledWith(11);
    expect(listTenants).toHaveBeenCalledWith(12);
    expect(result.current.data).toEqual([
      expect.objectContaining({ buildingId: 11, occupancyId: 1100 }),
      expect.objectContaining({ buildingId: 12, occupancyId: 1200 }),
    ]);
  });
});
