import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { getLeaseByOccupancy } from "./apis";
beforeEach(() => vi.clearAllMocks());
describe("leaseContracts apis", () => {
  it("getByOccupancy: 행 없으면 null", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    from.mockReturnValue({ select: () => ({ eq }) });
    expect(await getLeaseByOccupancy(5)).toBeNull();
  });
  it("getByOccupancy: snake→camel", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: {
      id:1, occupancy_id:5, deposit:1000000, monthly_rent:500000,
      start_date:"2026-01-01", end_date:"2027-01-01", expiry_alert:true,
      lease_type:"month", deposit_date:"2025-12-20", jeonse_deposit:null, bank_account:"국민 123",
    }, error:null });
    const eq = vi.fn(() => ({ maybeSingle }));
    from.mockReturnValue({ select: () => ({ eq }) });
    const r = await getLeaseByOccupancy(5);
    expect(r).toEqual({
      id:1, occupancyId:5, deposit:1000000, monthlyRent:500000,
      startDate:"2026-01-01", endDate:"2027-01-01", expiryAlert:true,
      leaseType:"month", depositDate:"2025-12-20", jeonseDeposit:null, bankAccount:"국민 123",
    });
  });
});
