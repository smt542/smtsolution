import { describe, it, expect, vi, beforeEach } from "vitest";

const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));

import { listAsCategories } from "./index";

beforeEach(() => vi.clearAllMocks());

describe("asCategories", () => {
  it("as_categories 테이블 바인딩", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    from.mockReturnValue({ select: () => ({ is: () => ({ order }) }) });
    await listAsCategories();
    expect(from).toHaveBeenCalledWith("as_categories");
  });
});
