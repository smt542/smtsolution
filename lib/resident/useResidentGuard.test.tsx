import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  router: { replace: vi.fn() },
}));

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));
const claims = vi.hoisted(() => ({ useResidentMyLink: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => nav.router }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth }),
}));
vi.mock("@/hooks/reactquery/residentClaims", () => claims);

import { useResidentGuard } from "./useResidentGuard";

const linkedHousehold = {
  claimId: 1,
  orgId: 2,
  buildingId: 3,
  buildingName: "그린빌라",
  unitId: 4,
  unitNo: "201호",
  occupancyId: 5,
  tenantName: "김주민",
  occupancyPhone: "01012345678",
  linkedAt: "2026-08-19T00:00:00Z",
};

const linkQuery = (data: typeof linkedHousehold | null) => ({
  data,
  error: null,
  isPending: false,
  refetch: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  claims.useResidentMyLink.mockReturnValue(linkQuery(linkedHousehold));
});

describe("useResidentGuard", () => {
  it("redirects an anonymous visitor to resident login", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const { result } = renderHook(() => useResidentGuard());

    await waitFor(() => {
      expect(nav.router.replace).toHaveBeenCalledWith("/resident/login");
    });
    expect(result.current.link).toBeNull();
  });

  it("redirects an authenticated resident without a link to verification", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "resident-1" } }, error: null });
    claims.useResidentMyLink.mockReturnValue(linkQuery(null));

    renderHook(() => useResidentGuard());

    await waitFor(() => {
      expect(nav.router.replace).toHaveBeenCalledWith("/resident/verify");
    });
  });

  it("returns the linked household for an authenticated resident", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "resident-1" } }, error: null });

    const { result } = renderHook(() => useResidentGuard());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.link).toEqual(linkedHousehold);
    expect(nav.router.replace).not.toHaveBeenCalled();
  });
});
