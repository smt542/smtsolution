import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_staffContext", () => ({ getStaffContext: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/org/useOrgContact", () => ({
  useOrgContact: () => ({ data: { phone: "02-1234-5678" } }),
}));
vi.mock("@/hooks/reactquery/residentSettlement", () => ({
  useMintSettlementShareToken: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/reactquery/units", () => ({ useUnits: vi.fn() }));
vi.mock("@/hooks/reactquery/movingSettlement", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/hooks/reactquery/movingSettlement")
  >();
  return {
    ...actual,
    useSettlementContext: vi.fn(),
    useSaveSettlement: () => ({ mutate: vi.fn(), isPending: false }),
    useCompleteSettlement: () => ({ mutate: vi.fn(), isPending: false }),
    useMidMoveout: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteSettlement: () => ({ mutate: vi.fn(), isPending: false }),
    useSettlementInquiry: () => ({
      data: { rows: [], total: 0 },
      isLoading: false,
      error: null,
    }),
  };
});

import { useBuildings } from "@/hooks/reactquery/buildings";
import { useSettlementContext } from "@/hooks/reactquery/movingSettlement";
import { useUnits } from "@/hooks/reactquery/units";
import { getStaffContext } from "../_staffContext";
import MovingSettlementPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStaffContext).mockResolvedValue({
    orgId: 3,
    role: "staff",
    orgStatus: "active",
    username: "staff1",
    fullName: "담당자",
    isActive: true,
    mustChangePassword: false,
    staffType: "manager_staff",
    permissions: ["moving"],
  });
  vi.mocked(useBuildings).mockReturnValue({
    data: [{ id: 3, name: "해오름" }],
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useUnits).mockReturnValue({
    data: [{ id: 101, unitNo: "101호", dong: "A동" }],
    isLoading: false,
    error: null,
  } as never);
  vi.mocked(useSettlementContext).mockReturnValue({
    data: {
      unit: {
        id: 101,
        unitNo: "101호",
        dong: "A동",
        buildingId: 3,
        buildingName: "해오름",
      },
      occupancy: {
        id: 9,
        tenantName: "홍길동",
        phone: "010-1234-5678",
        alimtalkOptIn: true,
        moveInDate: "2025-08-01",
        settlementNote: null,
        billingNote: null,
        status: "occupied",
      },
      latestSettlement: null,
      settleAccount: {
        settleBank: "한국은행",
        settleAcct: "123",
        settleHolder: "관리실",
      },
      checklist: [{ id: 7, label: "열쇠 반납", checked: false }],
      meterSummary: [
        { utility: "water", previousReading: 10, currentReading: 14, usage: 4 },
      ],
    },
    isLoading: false,
    error: null,
  } as never);
});

describe("MovingSettlementPage", () => {
  it("건물·호실 선택 뒤 context를 표시한다", async () => {
    render(await MovingSettlementPage());

    expect(screen.getByRole("heading", { name: "전체 건물" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "이사정산 입력" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("건물 선택"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("호실 선택"), {
      target: { value: "101" },
    });

    expect(useSettlementContext).toHaveBeenLastCalledWith(101);
    await waitFor(() => expect(screen.getAllByText("해오름 101호")).toHaveLength(2));
    expect(screen.getByLabelText("수도 입금계좌")).toHaveValue("123");
    expect(screen.getByLabelText("열쇠 반납")).toBeInTheDocument();
    expect(screen.getByLabelText("연락처")).toHaveValue("010-1234-5678");
  });

  it("moving 권한이 없으면 서버에서 정산 workspace를 노출하지 않는다", async () => {
    vi.mocked(getStaffContext).mockResolvedValue({
      orgId: 3,
      role: "staff",
      orgStatus: "active",
      username: "staff1",
      fullName: "담당자",
      isActive: true,
      mustChangePassword: false,
      staffType: "manager_staff",
      permissions: [],
    });

    render(await MovingSettlementPage());

    expect(screen.getByText(/이사정산 권한 필요/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "전체 건물" })).not.toBeInTheDocument();
    expect(useBuildings).not.toHaveBeenCalled();
  });
});
