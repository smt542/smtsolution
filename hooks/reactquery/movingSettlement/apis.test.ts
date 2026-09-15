import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc, from }) }));

import { movingSettlementSchema } from "@/components/forms/schema/movingSettlement";
import {
  calculateSettlementAmount,
  completeMovingSettlement,
  deletePartnerMovingSettlement,
  getSettlementContext,
  listSettlementInquiries,
  listSettlements,
  midMoveoutSettlement,
  saveMovingSettlement,
  savePartnerMovingSettlement,
  updateSettlementInquiryRows,
} from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("moving settlement apis", () => {
  it("getSettlementContext: 중첩 RPC 응답을 snake→camel로 매핑한다", async () => {
    rpc.mockResolvedValue({
      data: {
        unit: {
          id: 101,
          unit_no: "101호",
          dong: "A동",
          building_id: 3,
          building_name: "해오름",
        },
        occupancy: {
          id: 9,
          tenant_name: "홍길동",
          phone: "010-1234-5678",
          alimtalk_opt_in: true,
          move_in_date: "2025-08-01",
          settlement_note: "열쇠 반납",
          billing_note: null,
          status: "moving_out",
        },
        latest_settlement: {
          id: 31,
          unit_id: 101,
          occupancy_id: 9,
          move_out_date: "2026-08-13",
          mgmt_fee_monthly: 300000,
          mgmt_fee_prorated: 125806,
          water_charge: 12000,
          elec_charge: 23000,
          gas_charge: 8000,
          elec_paid_date: "2026-08-12",
          gas_paid_date: null,
          repair_amount: 50000,
          repair_attribution: "owner",
          repair_memo: "도어락",
          settle_bank: "한국은행",
          settle_acct: "123-456",
          settle_holder: "관리사무소",
          settlement_amount: 218806,
          note: "확인",
          settlement_note: "퇴실 정산",
          status: "saved",
          processed_at: null,
          created_at: "2026-08-13T01:00:00Z",
          updated_at: "2026-08-13T02:00:00Z",
        },
        settle_account: {
          settle_bank: "한국은행",
          settle_acct: "123-456",
          settle_holder: "관리사무소",
        },
        checklist: [{ id: 7, label: "열쇠 반납", checked: true }],
        meter_summary: [{ utility: "elec", previous_reading: 100, current_reading: 145, usage: 45 }],
      },
      error: null,
    });

    const context = await getSettlementContext(101);

    expect(rpc).toHaveBeenCalledWith("get_settlement_context", { p_unit_id: 101 });
    expect(context.unit).toEqual({
      id: 101,
      unitNo: "101호",
      dong: "A동",
      buildingId: 3,
      buildingName: "해오름",
    });
    expect(context.occupancy).toMatchObject({
      id: 9,
      tenantName: "홍길동",
      phone: "010-1234-5678",
      alimtalkOptIn: true,
      moveInDate: "2025-08-01",
      settlementNote: "열쇠 반납",
      billingNote: null,
      status: "moving_out",
    });
    expect(context.latestSettlement).toMatchObject({
      id: 31,
      unitId: 101,
      occupancyId: 9,
      moveOutDate: "2026-08-13",
      mgmtFeeProrated: 125806,
      elecPaidDate: "2026-08-12",
      repairAttribution: "owner",
      settlementAmount: 218806,
      processedAt: null,
    });
    expect(context.settleAccount).toEqual({
      settleBank: "한국은행",
      settleAcct: "123-456",
      settleHolder: "관리사무소",
    });
    expect(context.checklist).toEqual([{ id: 7, label: "열쇠 반납", checked: true }]);
    expect(context.meterSummary).toEqual([
      { utility: "elec", previousReading: 100, currentReading: 145, usage: 45 },
    ]);
  });

  it("getSettlementContext: nullable 중첩 값을 유지한다", async () => {
    rpc.mockResolvedValue({
      data: {
        unit: { id: 102, unit_no: "102호", dong: null, building_id: 3 },
        occupancy: null,
        latest_settlement: null,
        settle_account: { settle_bank: null, settle_acct: null, settle_holder: null },
        checklist: [],
        meter_summary: [],
      },
      error: null,
    });

    const context = await getSettlementContext(102);

    expect(context.occupancy).toBeNull();
    expect(context.latestSettlement).toBeNull();
    expect(context.unit.dong).toBeNull();
  });

  it("saveMovingSettlement: camel 입력을 RPC의 snake payload로 변환한다", async () => {
    rpc.mockResolvedValue({
      data: { settlement_id: 31, settlement_amount: 218806 },
      error: null,
    });

    const result = await saveMovingSettlement({
      unitId: 101,
      occupancyId: 9,
      settlementId: 31,
      data: {
        moveOutDate: "2026-08-13",
        mgmtFeeMonthly: 300000,
        mgmtFeeProrated: 125806,
        waterCharge: 12000,
        elecCharge: 23000,
        gasCharge: 8000,
        elecPaidDate: "2026-08-12",
        gasPaidDate: null,
        repairAmount: 50000,
        repairAttribution: "owner",
        repairMemo: "도어락",
        settleBank: "한국은행",
        settleAcct: "123-456",
        settleHolder: "관리사무소",
        note: "확인",
        settlementNote: "퇴실 정산",
      },
      checklist: [{ checkItemId: 7, checked: true }],
    });

    expect(rpc).toHaveBeenCalledWith("save_moving_settlement", {
      p_unit_id: 101,
      p_occupancy_id: 9,
      p_settlement_id: 31,
      p_data: {
        move_out_date: "2026-08-13",
        mgmt_fee_monthly: 300000,
        mgmt_fee_prorated: 125806,
        water_charge: 12000,
        elec_charge: 23000,
        gas_charge: 8000,
        elec_paid_date: "2026-08-12",
        gas_paid_date: null,
        repair_amount: 50000,
        repair_attribution: "owner",
        repair_memo: "도어락",
        settle_bank: "한국은행",
        settle_acct: "123-456",
        settle_holder: "관리사무소",
        note: "확인",
        settlement_note: "퇴실 정산",
      },
      p_checklist: [{ check_item_id: 7, checked: true }],
    });
    expect(result).toEqual({ settlementId: 31, settlementAmount: 218806 });
  });

  it("현장 이사정산 저장·삭제는 전용 RPC를 사용한다", async () => {
    rpc
      .mockResolvedValueOnce({
        data: { settlement_id: 31, settlement_amount: 218806 },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const input = {
      unitId: 101,
      occupancyId: 9,
      settlementId: null,
      data: { move_out_date: "2026-09-15" },
      checklist: [{ check_item_id: 7, checked: true }],
    };
    await expect(savePartnerMovingSettlement(input)).resolves.toEqual({
      settlementId: 31,
      settlementAmount: 218806,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "partner_save_moving_settlement", {
      p_unit_id: 101,
      p_occupancy_id: 9,
      p_settlement_id: null,
      p_data: input.data,
      p_checklist: input.checklist,
    });

    await deletePartnerMovingSettlement(31);
    expect(rpc).toHaveBeenNthCalledWith(2, "partner_delete_moving_settlement", {
      p_settlement_id: 31,
    });
  });

  it("completeMovingSettlement: 완료 RPC를 호출한다", async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });

    await expect(completeMovingSettlement(31)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("complete_moving_settlement", { p_settlement_id: 31 });
  });

  it("midMoveoutSettlement: 중도퇴실 RPC를 호출한다", async () => {
    rpc.mockResolvedValue({ data: { ok: true }, error: null });

    await expect(midMoveoutSettlement(31)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("mid_moveout_settlement", { p_settlement_id: 31 });
  });

  it("listSettlements: 날짜범위 RPC 결과를 snake→camel로 매핑한다", async () => {
    rpc.mockResolvedValue({
      data: [{
        settlement_id: 31,
        unit_id: 101,
        occupancy_id: 9,
        unit_no: "101호",
        tenant_name: "홍길동",
        status: "completed",
        settlement_amount: 218806,
        move_out_date: "2026-08-13",
        processed_at: "2026-08-13T03:00:00Z",
        created_at: "2026-08-13T01:00:00Z",
      }],
      error: null,
    });

    const rows = await listSettlements(3, "2026-08-01", "2026-08-31");

    expect(rpc).toHaveBeenCalledWith("list_settlements", {
      p_building_id: 3,
      p_from: "2026-08-01",
      p_to: "2026-08-31",
    });
    expect(rows).toEqual([{
      settlementId: 31,
      unitId: 101,
      occupancyId: 9,
      unitNo: "101호",
      tenantName: "홍길동",
      status: "completed",
      settlementAmount: 218806,
      moveOutDate: "2026-08-13",
      processedAt: "2026-08-13T03:00:00Z",
      createdAt: "2026-08-13T01:00:00Z",
    }]);
  });

  it("listSettlementInquiries: 유형·필터·페이지를 RPC에 전달하고 합계와 행을 매핑한다", async () => {
    rpc.mockResolvedValue({
      data: [{
        settlement_id: 31,
        building_id: 3,
        building_code: "B003",
        building_name: "해오름",
        building_address: "용전동",
        unit_id: 101,
        occupancy_id: 9,
        dong: "A동",
        unit_no: "101호",
        tenant_name: "홍길동",
        status: "completed",
        move_out_date: "2026-08-13",
        move_in_date: "2025-08-01",
        mgmt_fee_prorated: 125806,
        water_charge: 12000,
        elec_charge: 23000,
        gas_charge: 8000,
        elec_previous_reading: 100,
        elec_current_reading: 125,
        elec_usage: 25,
        gas_previous_reading: 20,
        gas_current_reading: 24,
        gas_usage: 4,
        elec_paid_date: "2026-08-12",
        gas_paid_date: null,
        repair_amount: 50000,
        cleaning_cost: 69000,
        checked_by_name: "김관리",
        settlement_amount: 218806,
        processed_at: "2026-08-13T03:00:00Z",
        created_at: "2026-08-13T01:00:00Z",
        total_count: 27,
      }],
      error: null,
    });

    const result = await listSettlementInquiries({
      type: "electric",
      buildingId: 3,
      from: "2026-08-01",
      to: "2026-08-31",
      search: "홍길동",
      status: "completed",
      page: 2,
      pageSize: 20,
    });

    expect(rpc).toHaveBeenCalledWith("list_settlement_inquiries", {
      p_type: "elec",
      p_building_id: 3,
      p_from: "2026-08-01",
      p_to: "2026-08-31",
      p_search: "홍길동",
      p_status: "completed",
      p_sort: "date",
      p_limit: 20,
      p_offset: 20,
    });
    expect(result).toEqual({
      total: 27,
      rows: [{
        settlementId: 31,
        buildingId: 3,
        buildingCode: "B003",
        buildingName: "해오름",
        buildingAddress: "용전동",
        unitId: 101,
        occupancyId: 9,
        dong: "A동",
        unitNo: "101호",
        tenantName: "홍길동",
        status: "completed",
        moveOutDate: "2026-08-13",
        moveInDate: "2025-08-01",
        mgmtFeeProrated: 125806,
        waterCharge: 12000,
        elecCharge: 23000,
        gasCharge: 8000,
        elecPreviousReading: 100,
        elecCurrentReading: 125,
        elecUsage: 25,
        gasPreviousReading: 20,
        gasCurrentReading: 24,
        gasUsage: 4,
        elecPaidDate: "2026-08-12",
        gasPaidDate: null,
        repairAmount: 50000,
        cleaningCost: 69000,
        checkedByName: "김관리",
        settlementAmount: 218806,
        processedAt: "2026-08-13T03:00:00Z",
        createdAt: "2026-08-13T01:00:00Z",
      }],
    });
  });

  it("updateSettlementInquiryRows: 편집 가능한 세 필드를 일괄 저장한다", async () => {
    rpc.mockResolvedValue({ data: { count: 1 }, error: null });

    await expect(updateSettlementInquiryRows([{
      settlementId: 31,
      elecPaidDate: "2026-08-20",
      gasPaidDate: null,
      cleaningCost: 69000,
    }])).resolves.toEqual({ count: 1 });

    expect(rpc).toHaveBeenCalledWith("update_settlement_inquiry_rows", {
      p_rows: [{
        settlement_id: 31,
        elec_paid_date: "2026-08-20",
        gas_paid_date: null,
        cleaning_cost: 69000,
      }],
    });
  });

  it("calculateSettlementAmount: null을 0으로 보고 다섯 금액을 합산한다", () => {
    expect(calculateSettlementAmount({
      mgmtFeeProrated: 125806,
      waterCharge: 12000,
      elecCharge: null,
      gasCharge: 8000,
      repairAmount: 50000,
    })).toBe(195806);
  });

  it("movingSettlementSchema: 퇴실일·정수·0 이상·수리비 귀속을 검증한다", () => {
    const valid = {
      moveOutDate: "2026-08-13",
      mgmtFeeMonthly: 300000,
      mgmtFeeProrated: 125806,
      waterCharge: 0,
      elecCharge: null,
      gasCharge: 8000,
      elecPaidDate: "",
      gasPaidDate: "",
      repairAmount: 50000,
      repairAttribution: "manager" as const,
      repairMemo: "",
      settleBank: "",
      settleAcct: "",
      settleHolder: "",
      note: "",
      settlementNote: "",
    };

    expect(movingSettlementSchema.safeParse(valid).success).toBe(true);
    expect(movingSettlementSchema.safeParse({ ...valid, moveOutDate: "" }).success).toBe(false);
    expect(movingSettlementSchema.safeParse({ ...valid, waterCharge: -1 }).success).toBe(false);
    expect(movingSettlementSchema.safeParse({ ...valid, repairAmount: 1.5 }).success).toBe(false);
    expect(movingSettlementSchema.safeParse({ ...valid, repairAttribution: "tenant" }).success).toBe(false);
  });

  it("RPC 오류를 전달한다", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "조회 실패" } });
    await expect(listSettlements(3, "2026-08-01", "2026-08-31")).rejects.toThrow("조회 실패");
  });
});
