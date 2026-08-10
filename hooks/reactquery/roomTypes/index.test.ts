import { describe, it, expect, vi, beforeEach } from "vitest";

const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));

import { listRoomTypes } from "./index";

beforeEach(() => vi.clearAllMocks());

describe("roomTypes", () => {
  it("room_types 테이블 바인딩", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    from.mockReturnValue({ select: () => ({ is: () => ({ order }) }) });
    await listRoomTypes();
    expect(from).toHaveBeenCalledWith("room_types");
  });
});
