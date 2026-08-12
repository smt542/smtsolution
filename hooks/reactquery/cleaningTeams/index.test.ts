import { describe, it, expect, vi, beforeEach } from "vitest";

const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));

import { listCleaningTeams } from "./index";

beforeEach(() => vi.clearAllMocks());

describe("cleaningTeams", () => {
  it("cleaning_teams 테이블 바인딩", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    from.mockReturnValue({ select: () => ({ is: () => ({ order }) }) });
    await listCleaningTeams();
    expect(from).toHaveBeenCalledWith("cleaning_teams");
  });
});
