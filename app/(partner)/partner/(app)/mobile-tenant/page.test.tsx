import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));

import PartnerTenantPage from "./page";

const occupancy = {
  unit_id: 101,
  building_id: 3,
  building_name: "그린빌라",
  unit_no: "101호",
  dong: "A동",
  tenant_name: "홍길동",
  payer_name: "홍길동",
  phone: "010-1234-5678",
  resident_count: 2,
  vehicle_no: null,
  move_in_date: "2025-08-01",
  status: "occupied",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockImplementation((name: string) => {
    if (name === "partner_get_occupancy") {
      return Promise.resolve({ data: [occupancy], error: null });
    }
    if (name === "partner_list_unit_payments") {
      return Promise.resolve({
        data: [{
          period: "2026-08-01",
          due_date: "2026-08-31",
          charged: 100_000,
          paid: 80_000,
          unpaid: 20_000,
          last_paid_at: "2026-08-20",
          methods: "transfer",
          memo: null,
        }],
        error: null,
      });
    }
    return Promise.resolve({
      data: [{
        id: 9,
        tenant_name: "홍길동",
        status: "completed",
        settlement_amount: 50_000,
        move_out_date: "2026-09-01",
        created_at: "2026-08-25",
      }],
      error: null,
    });
  });
});

describe("PartnerTenantPage", () => {
  it("Server에서 세 조회를 병렬 수행하고 Client 탭에 전달한다", async () => {
    render(await PartnerTenantPage({ searchParams: Promise.resolve({ id: "101" }) }));

    expect(screen.getAllByText("그린빌라").length).toBeGreaterThan(0);
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith("partner_get_occupancy", { p_unit_id: 101 });
    expect(mocks.rpc).toHaveBeenCalledWith("partner_list_unit_payments", { p_unit_id: 101 });
    expect(mocks.rpc).toHaveBeenCalledWith("partner_list_unit_settlements", { p_unit_id: 101 });

    fireEvent.click(screen.getByRole("button", { name: "수납정보" }));
    expect(screen.getByText("2026.08")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /이사정산 1/ }));
    expect(screen.getByText("No.1 홍길동")).toBeInTheDocument();
  });

  it("유효한 unit ID가 없으면 RPC 없이 기존 빈 상태를 표시한다", async () => {
    render(await PartnerTenantPage({ searchParams: Promise.resolve({ id: "invalid" }) }));

    expect(screen.getByText("세대 정보를 찾을 수 없어요")).toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
