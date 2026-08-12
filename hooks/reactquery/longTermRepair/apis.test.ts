import { describe, it, expect, vi, beforeEach } from "vitest";

const uploadMock = vi.fn();
const removeMock = vi.fn();
const createSignedUrlMock = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from,
    storage: {
      from: () => ({
        upload: uploadMock,
        remove: removeMock,
        createSignedUrl: createSignedUrlMock,
      }),
    },
  }),
}));

import {
  listRepairsByBuilding,
  createRepair,
  deleteRepair,
  uploadRepairAttachment,
} from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("longTermRepair apis", () => {
  it("listByBuilding: building_id·deleted_at null·work_date desc + 매핑", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          org_id: 9,
          building_id: 3,
          work_name: "방수",
          work_date: "2026-05-01",
          amount: 500000,
          memo: null,
        },
      ],
      error: null,
    });
    const is = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ is }));
    from.mockReturnValue({ select: () => ({ eq }) });

    const r = await listRepairsByBuilding(3);

    expect(eq).toHaveBeenCalledWith("building_id", 3);
    expect(r[0]).toMatchObject({
      id: 1,
      orgId: 9,
      buildingId: 3,
      workName: "방수",
      workDate: "2026-05-01",
      amount: 500000,
    });
  });

  it("create: snake row insert", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 2,
        org_id: 9,
        building_id: 3,
        work_name: "도장",
        work_date: null,
        amount: null,
        memo: null,
      },
      error: null,
    });
    const ins = vi.fn(() => ({ select: () => ({ single }) }));
    from.mockReturnValue({ insert: ins });

    await createRepair({ orgId: 9, buildingId: 3, workName: "도장" });

    expect(ins).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 9,
        building_id: 3,
        work_name: "도장",
      })
    );
  });

  it("delete: soft(deleted_at)", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const upd = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update: upd });

    await deleteRepair(5);

    expect(upd).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) })
    );
  });

  it("uploadRepairAttachment: long_term_repair 경로·엔티티로 저장", async () => {
    uploadMock.mockResolvedValue({ error: null });
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 10,
        org_id: 9,
        entity_type: "long_term_repair",
        entity_id: 2,
        kind: "repair",
        file_url: "9/long_term_repair/2/x.pdf",
        file_name: "x.pdf",
        created_at: "t",
      },
      error: null,
    });
    const ins = vi.fn(() => ({ select: () => ({ single }) }));
    from.mockReturnValue({ insert: ins });

    const file = new File(["c"], "x.pdf", { type: "application/pdf" });
    await uploadRepairAttachment({ repairId: 2, orgId: 9, file });

    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^9\/long_term_repair\/2\//),
      file
    );
    expect(ins).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: "long_term_repair",
        entity_id: 2,
        kind: "repair",
        org_id: 9,
      })
    );
  });
});
