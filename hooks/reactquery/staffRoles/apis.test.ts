import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listStaffRoles, createStaffRole, deleteStaffRole } from "./apis";
beforeEach(() => vi.clearAllMocks());

describe("staffRoles apis", () => {
  it("listStaffRoles: 소프트삭제 제외 + 매핑", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 1, org_id: 9, label: "관리", sort_order: 1 }], error: null });
    const is = vi.fn(() => ({ order }));
    from.mockReturnValue({ select: () => ({ is }) });
    const r = await listStaffRoles();
    expect(is).toHaveBeenCalledWith("deleted_at", null);
    expect(r[0]).toMatchObject({ id: 1, label: "관리", sortOrder: 1 });
  });

  it("createStaffRole: org_id 포함 insert", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 2, org_id: 9, label: "검침", sort_order: 2 }, error: null });
    const sel = vi.fn(() => ({ single })); const ins = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ insert: ins });
    await createStaffRole({ orgId: 9, label: "검침", sortOrder: 2 });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ org_id: 9, label: "검침", sort_order: 2 }));
  });

  it("deleteStaffRole: soft delete(deleted_at)", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null }); const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });
    await deleteStaffRole(1);
    expect(upd).toHaveBeenCalledWith(expect.objectContaining({ deleted_at: expect.any(String) }));
  });
});
