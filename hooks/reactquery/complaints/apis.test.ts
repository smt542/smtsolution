/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from, rpc }) }));

import {
  createComplaint,
  createPartnerComplaint,
  createComplaintResolution,
  deleteComplaint,
  deletePartnerComplaint,
  getPartnerComplaintEditor,
  deleteComplaintResolution,
  listComplaintResolutions,
  listComplaints,
  listPartnerUnits,
  updatePartnerComplaint,
  updateComplaintResolution,
  updateComplaintStatus,
} from "./apis";

function complaintRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    org_id: 7,
    building_id: 2,
    unit_id: 21,
    category_id: 4,
    title: "욕실 수전 누수",
    content: "물이 계속 떨어집니다.",
    status: "pending",
    reporter_name: "김입주",
    reporter_phone: "010-1234-5678",
    assigned_to: "worker-1",
    received_at: "2026-08-12T00:00:00.000Z",
    completed_at: null,
    created_by: "staff-1",
    created_at: "2026-08-12T00:00:00.000Z",
    updated_at: "2026-08-12T00:00:00.000Z",
    building: { name: "그린빌라" },
    unit: { unit_no: "101호", dong: "A동" },
    category: { label: "수도" },
    complaint_resolutions: [
      {
        id: 91,
        complaint_id: 11,
        result_content: "패킹 교체",
        result_notes: null,
        resolved_by: "worker-1",
        resolved_at: "2026-08-12T02:00:00.000Z",
        created_at: "2026-08-12T02:00:00.000Z",
        updated_at: "2026-08-12T02:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("complaints apis", () => {
  it("목록 조회에서 소프트 삭제를 제외하고 필터·관계 매핑을 적용", async () => {
    const builder: any = {};
    builder.select = vi.fn(() => builder);
    builder.is = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.gte = vi.fn(() => builder);
    builder.lte = vi.fn(() => builder);
    builder.or = vi.fn(() => builder);
    builder.order = vi.fn().mockResolvedValue({ data: [complaintRow()], error: null });
    from.mockReturnValue(builder);

    const result = await listComplaints({
      buildingId: 2,
      categoryId: 4,
      statuses: ["pending", "on_hold"],
      receivedFrom: "2026-08-01T00:00:00.000Z",
      receivedTo: "2026-08-31T23:59:59.999Z",
      search: "누수",
    });

    expect(from).toHaveBeenCalledWith("complaints");
    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
    expect(builder.eq).toHaveBeenCalledWith("building_id", 2);
    expect(builder.eq).toHaveBeenCalledWith("category_id", 4);
    expect(builder.in).toHaveBeenCalledWith("status", ["pending", "on_hold"]);
    expect(builder.gte).toHaveBeenCalledWith("received_at", "2026-08-01T00:00:00.000Z");
    expect(builder.lte).toHaveBeenCalledWith("received_at", "2026-08-31T23:59:59.999Z");
    expect(builder.or).toHaveBeenCalledWith(expect.stringContaining("title.ilike.%누수%"));
    expect(result[0]).toMatchObject({
      id: 11,
      orgId: 7,
      buildingName: "그린빌라",
      unitNo: "101호",
      unitDong: "A동",
      categoryLabel: "수도",
      reporterName: "김입주",
    });
    expect(result[0].resolutions[0]).toMatchObject({ id: 91, resultContent: "패킹 교체" });
  });

  it("접수 등록 시 camelCase 입력을 DB 컬럼으로 변환", async () => {
    const single = vi.fn().mockResolvedValue({ data: complaintRow(), error: null });
    const builder: any = {};
    builder.insert = vi.fn(() => builder);
    builder.select = vi.fn(() => builder);
    builder.single = single;
    from.mockReturnValue(builder);

    await createComplaint({
      orgId: 7,
      buildingId: 2,
      unitId: 21,
      categoryId: 4,
      title: "욕실 수전 누수",
      content: "물이 계속 떨어집니다.",
      status: "pending",
      reporterName: "김입주",
      reporterPhone: "010-1234-5678",
      assignedTo: "worker-1",
    });

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      org_id: 7,
      building_id: 2,
      unit_id: 21,
      category_id: 4,
      reporter_name: "김입주",
      reporter_phone: "010-1234-5678",
      assigned_to: "worker-1",
    }));
  });

  it("완결 상태 변경 시 completed_at을 함께 기록", async () => {
    const builder: any = {};
    builder.update = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.select = vi.fn(() => builder);
    builder.single = vi.fn().mockResolvedValue({
      data: complaintRow({ status: "completed", completed_at: "2026-08-12T03:00:00.000Z" }),
      error: null,
    });
    from.mockReturnValue(builder);

    await updateComplaintStatus(11, "completed");
    expect(builder.update).toHaveBeenCalledWith({
      status: "completed",
      completed_at: expect.any(String),
    });
    expect(builder.eq).toHaveBeenCalledWith("id", 11);
  });

  it("접수 삭제는 물리 삭제 대신 deleted_at을 기록", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    from.mockReturnValue({ update });

    await deleteComplaint(11);
    expect(update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    expect(eq).toHaveBeenCalledWith("id", 11);
  });
});

describe("complaint resolutions apis", () => {
  const resolutionRow = {
    id: 91,
    complaint_id: 11,
    result_content: "패킹 교체",
    result_notes: "재방문 없음",
    resolved_by: "worker-1",
    resolved_at: "2026-08-12T02:00:00.000Z",
    created_at: "2026-08-12T02:00:00.000Z",
    updated_at: "2026-08-12T02:00:00.000Z",
  };

  it("처리이력 목록을 최신 처리일 순으로 조회", async () => {
    const order = vi.fn().mockResolvedValue({ data: [resolutionRow], error: null });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValue({ select });

    const result = await listComplaintResolutions(11);
    expect(eq).toHaveBeenCalledWith("complaint_id", 11);
    expect(order).toHaveBeenCalledWith("resolved_at", { ascending: false, nullsFirst: false });
    expect(result[0]).toMatchObject({ complaintId: 11, resultContent: "패킹 교체" });
  });

  it("처리이력을 등록하고 수정", async () => {
    const createBuilder: any = {};
    createBuilder.insert = vi.fn(() => createBuilder);
    createBuilder.select = vi.fn(() => createBuilder);
    createBuilder.single = vi.fn().mockResolvedValue({ data: resolutionRow, error: null });
    from.mockReturnValueOnce(createBuilder);

    await createComplaintResolution({
      complaintId: 11,
      resultContent: "패킹 교체",
      resultNotes: "재방문 없음",
    });
    expect(createBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      complaint_id: 11,
      result_content: "패킹 교체",
      result_notes: "재방문 없음",
    }));

    const updateBuilder: any = {};
    updateBuilder.update = vi.fn(() => updateBuilder);
    updateBuilder.eq = vi.fn(() => updateBuilder);
    updateBuilder.select = vi.fn(() => updateBuilder);
    updateBuilder.single = vi.fn().mockResolvedValue({ data: resolutionRow, error: null });
    from.mockReturnValueOnce(updateBuilder);

    await updateComplaintResolution(91, { resultContent: "부품 교체 완료" });
    expect(updateBuilder.update).toHaveBeenCalledWith({ result_content: "부품 교체 완료" });
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", 91);
  });

  it("처리이력은 스키마 규약대로 실제 삭제", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn(() => ({ eq }));
    from.mockReturnValue({ delete: remove });

    await deleteComplaintResolution(91);
    expect(remove).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith("id", 91);
  });
});

describe("partner complaint apis", () => {
  it("상세와 카테고리를 함께 조회하고 세대 목록을 반환한다", async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{ id: 11, building_name: "해오름", is_mine: true }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [{ id: 2, label: "수도" }], error: null });

    await expect(getPartnerComplaintEditor(11)).resolves.toMatchObject({
      detail: { id: 11, building_name: "해오름", is_mine: true },
      categories: [{ id: 2, label: "수도" }],
    });

    rpc.mockResolvedValueOnce({
      data: [{ unit_id: 101, unit_no: "101호", dong: "A동", phone: "010" }],
      error: null,
    });
    await expect(listPartnerUnits(3)).resolves.toHaveLength(1);
    expect(rpc).toHaveBeenLastCalledWith("partner_list_units", {
      p_building_id: 3,
    });
  });

  it("현장 A/S 등록·수정·삭제 RPC payload를 한 API 계층에서 관리한다", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await createPartnerComplaint({
      buildingId: 3,
      unitId: 101,
      categoryId: 2,
      content: "누수",
      status: "pending",
      completedAt: null,
      resultContent: "",
      reporterPhone: "010",
    });
    expect(rpc).toHaveBeenLastCalledWith("partner_create_complaint", {
      p_building_id: 3,
      p_unit_id: 101,
      p_category_id: 2,
      p_content: "누수",
      p_status: "pending",
      p_completed_at: null,
      p_result_content: "",
      p_reporter_phone: "010",
    });

    await updatePartnerComplaint({
      id: 11,
      categoryId: 2,
      content: "처리",
      status: "completed",
      completedAt: "2026-09-15T01:00:00.000Z",
      resultContent: "완료",
    });
    expect(rpc).toHaveBeenLastCalledWith("partner_update_complaint", {
      p_id: 11,
      p_category_id: 2,
      p_content: "처리",
      p_status: "completed",
      p_completed_at: "2026-09-15T01:00:00.000Z",
      p_result_content: "완료",
    });

    await deletePartnerComplaint(11);
    expect(rpc).toHaveBeenLastCalledWith("partner_delete_complaint", { p_id: 11 });
  });
});
