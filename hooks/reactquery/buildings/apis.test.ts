import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listBuildings, createBuilding, updateBuilding } from "./apis";
beforeEach(() => vi.clearAllMocks());
describe("buildings apis", () => {
  it("listBuildings: snake→camel 매핑", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id:1, org_id:9, code:"001", name:"그린빌라", type_id:null, owner_name:"박정호" }], error:null });
    from.mockReturnValue({ select: () => ({ order }) });
    const r = await listBuildings();
    expect(r[0]).toMatchObject({ id:1, code:"001", name:"그린빌라", ownerName:"박정호" });
  });
  it("createBuilding: org_id 포함 insert", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:2, org_id:9, code:"002", name:"x" }, error:null });
    const sel = vi.fn(() => ({ single })); const ins = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ insert: ins });
    await createBuilding({ orgId:9, code:"002", name:"x" });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ org_id:9, code:"002", name:"x" }));
  });
  it("updateBuilding: 부분 업데이트는 제공된 필드만 전송", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:1, org_id:9, code:"001", name:"새이름" }, error:null });
    const sel = vi.fn(() => ({ single })); const eq = vi.fn(() => ({ select: sel })); const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });
    await updateBuilding(1, { name:"새이름" });
    expect(upd).toHaveBeenCalledWith({ name:"새이름" });
  });
});
