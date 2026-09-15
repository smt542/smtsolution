import { describe, it, expect, vi, beforeEach } from "vitest";

const from = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from,
  }),
}));

import {
  listVendors,
  createVendor,
  updateVendor,
} from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("vendors apis", () => {
  it("listVendors: snake→camel 매핑", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id:1, org_id:9, name:"홍길동전기", phone:"010-1234-5678", bank_account:"국민123", memo:"메모", category_id:2 }],
      error: null,
    });
    from.mockReturnValue({ select: () => ({ order }) });
    const r = await listVendors();
    expect(r[0]).toMatchObject({ id:1, orgId:9, name:"홍길동전기", phone:"010-1234-5678", bankAccount:"국민123", memo:"메모", categoryId:2 });
  });

  it("createVendor: org_id 포함 insert", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:3, org_id:9, name:"ABC", phone:null, bank_account:null, memo:null, category_id:1 }, error:null });
    const sel = vi.fn(() => ({ single }));
    const ins = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ insert: ins });
    await createVendor({ orgId:9, name:"ABC", categoryId:1 });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ org_id:9, name:"ABC", category_id:1 }));
  });

  it("updateVendor: 부분 업데이트는 제공된 필드만 전송", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:1, org_id:9, name:"새이름", phone:null, bank_account:null, memo:null, category_id:1 }, error:null });
    const sel = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select: sel }));
    const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });
    await updateVendor(1, { name:"새이름" });
    expect(upd).toHaveBeenCalledWith({ name:"새이름" });
  });
});
