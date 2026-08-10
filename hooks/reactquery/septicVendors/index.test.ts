import { describe, it, expect, vi, beforeEach } from "vitest";

const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));

import { listSepticVendors } from "./index";

beforeEach(() => vi.clearAllMocks());

describe("septicVendors", () => {
  it("septic_vendors 테이블 바인딩", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    from.mockReturnValue({ select: () => ({ is: () => ({ order }) }) });
    await listSepticVendors();
    expect(from).toHaveBeenCalledWith("septic_vendors");
  });
});
