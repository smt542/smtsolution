import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc, from }) }));

import { movingSettlementSchema } from "@/components/forms/schema/movingSettlement";
import {
  calculateSettlementAmount,
  completeMovingSettlement,
  getSettlementContext,
  listSettlements,
  midMoveoutSettlement,
  saveMovingSettlement,
} from "./apis";

beforeEach(() => vi.clearAllMocks());

describe("moving settlement apis", () => {
  it("getSettlementContext: 중첩 RPC 응답을 snake→camel로 매핑한다", async () => {
    rpc.mockResolvedValue({
      data: {
        unit: { id: 101, unit_no: "101호", dong: "A동", building_id: 3 },
        occupancy: {
          id: 9,
          tenant_name: "홍길동",
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
    expect(context.unit).toEqual({ id: 101, unitNo: "101호", dong: "A동", buildingId: 3 });
    expect(context.occupancy).toMatchObject({
      id: 9,
      tenantName: "홍길동",
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
