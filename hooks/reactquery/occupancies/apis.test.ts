import { describe, it, expect, vi, beforeEach } from "vitest";
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from }) }));
import { listOccupancies, createOccupancy, updateOccupancy } from "./apis";
beforeEach(() => vi.clearAllMocks());
describe("occupancies apis", () => {
  it("listOccupancies: unit_id로 필터, snake→camel 매핑", async () => {
    const resolve = vi.fn().mockResolvedValue({ data: [{ id:1, unit_id:5, tenant_name:"홍길동", payer_name:"홍길순", phone:"010-1234-5678", resident_count:3, vehicle_no:"12가3456", move_in_date:"2024-01-01", move_out_date:null, deposit:"5000000", monthly_rent:"500000", status:"occupied", memo:"비고" }], error:null });
    const eq = vi.fn(() => ({ order: resolve }));
    from.mockReturnValue({ select: () => ({ eq }) });
    const r = await listOccupancies(5);
    expect(eq).toHaveBeenCalledWith("unit_id", 5);
    expect(r[0]).toMatchObject({ id:1, unitId:5, tenantName:"홍길동", payerName:"홍길순", phone:"010-1234-5678", residentCount:3, vehicleNo:"12가3456", moveInDate:"2024-01-01", moveOutDate:null, deposit:5000000, monthlyRent:500000, status:"occupied", memo:"비고" });
  });
  it("createOccupancy: unit_id 포함 insert", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:2, unit_id:5, tenant_name:"김철수", status:"occupied" }, error:null });
    const sel = vi.fn(() => ({ single })); const ins = vi.fn(() => ({ select: sel }));
    from.mockReturnValue({ insert: ins });
    await createOccupancy({ unitId:5, tenantName:"김철수" });
    expect(ins).toHaveBeenCalledWith(expect.objectContaining({ unit_id:5, tenant_name:"김철수" }));
  });
  it("updateOccupancy: 부분 업데이트는 제공된 필드만 전송", async () => {
    const single = vi.fn().mockResolvedValue({ data:{ id:1, unit_id:5, tenant_name:"수정됨", status:"occupied" }, error:null });
    const sel = vi.fn(() => ({ single })); const eq = vi.fn(() => ({ select: sel })); const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });
    await updateOccupancy(1, { status:"moving_out" });
    expect(upd).toHaveBeenCalledWith({ status:"moving_out" });
  });
});
