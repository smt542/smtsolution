import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));

import { getPaymentReceiverName } from "./apis";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPaymentReceiverName", () => {
  it("payment created_by에 연결된 직원명을 반환한다", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: { created_by: "user-1" }, error: null })
      .mockResolvedValueOnce({ data: { full_name: "이관리" }, error: null });

    await expect(getPaymentReceiverName(31)).resolves.toBe("이관리");
    expect(from).toHaveBeenNthCalledWith(1, "payments");
    expect(from).toHaveBeenNthCalledWith(2, "profiles");
  });
});
