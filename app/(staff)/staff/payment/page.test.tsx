/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/bill", () => ({
  useBillOrganizationName: vi.fn(() => ({ data: "한빛관리" })),
  useBillDocuments: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
  getBillDocuments: vi.fn(),
  billKeys: { documents: vi.fn(() => ["bill", "documents"]) },
}));
vi.mock("@/hooks/reactquery/payments", () => ({
  cmsDownloadUrl: vi.fn(() => "/api/payment/cms"),
  listPaymentRows: vi.fn(),
  listBuildingPaymentDates: vi.fn(),
  listUnitPayments: vi.fn(),
  paymentKeys: {
    rows: vi.fn(() => ["payments", "rows"]),
    unit: vi.fn(() => ["payments", "unit"]),
    statementDates: vi.fn(() => ["payments", "statement-dates"]),
  },
  usePaymentRows: vi.fn(),
  useRecordPayment: vi.fn(),
  useCancelPayment: vi.fn(),
  useUnitPayments: vi.fn(),
  usePaymentReceiver: vi.fn(() => ({ data: "이관리", isLoading: false, isError: false })),
  useGiroPayments: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import PaymentProcessingPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useCancelPayment,
  useGiroPayments,
  usePaymentRows,
  useRecordPayment,
  useUnitPayments,
} from "@/hooks/reactquery/payments";
import { currentPeriod } from "@/lib/billing/period";

const master = {
  orgId: 7,
  role: "org_owner",
  orgStatus: "active",
  username: "boss",
  fullName: "이관리",
  isActive: true,
  mustChangePassword: false,
  staffType: "manager_staff",
  permissions: [],
};

const buildings = [
  { id: 2, orgId: 7, code: "001", name: "그린빌라", address: null },
  { id: 3, orgId: 7, code: "002", name: "블루하우스", address: null },
];

const rows = [
  {
    unitId: 21,
    unitNo: "101호",
    dong: "A동",
    occupancyId: 31,
    tenantName: "김입주",
    isVacant: false,
    isAutoDebit: true,
    dueDate: "2026-08-25",
    charged: 100_000,
    paid: 40_000,
    unpaid: 60_000,
    payStatus: "partial",
  },
] as any[];

const recordPaymentAsync = vi.fn();
const cancelPaymentAsync = vi.fn();
const refetch = vi.fn();

function mutation(mutateAsync: ReturnType<typeof vi.fn>) {
  return { mutateAsync, isPending: false } as any;
}

function setup(me: any = master) {
  vi.mocked(useMe).mockReturnValue({ data: me } as any);
  vi.mocked(useBuildings).mockReturnValue({ data: buildings, isLoading: false } as any);
  vi.mocked(usePaymentRows).mockReturnValue({
    data: rows,
    isLoading: false,
    isError: false,
    refetch,
  } as any);
  vi.mocked(useRecordPayment).mockReturnValue(mutation(recordPaymentAsync));
  vi.mocked(useCancelPayment).mockReturnValue(mutation(cancelPaymentAsync));
  vi.mocked(useUnitPayments).mockReturnValue({ data: [], isLoading: false } as any);
  vi.mocked(useGiroPayments).mockReturnValue({ data: [], isLoading: false } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  recordPaymentAsync.mockResolvedValue({ charged: 100_000, paid: 100_000, unpaid: 0 });
  cancelPaymentAsync.mockResolvedValue({ charged: 100_000, paid: 0, unpaid: 100_000 });
  setup();
});

describe("PaymentProcessingPage", () => {
  it("payment 권한이 없으면 수납 화면 접근을 차단", () => {
    setup({ ...master, role: "staff", permissions: [] });

    render(<PaymentProcessingPage />);

    expect(screen.getByText("수납 처리 권한이 없습니다")).toBeInTheDocument();
    expect(usePaymentRows).not.toHaveBeenCalled();
  });

  it("호실별 부과·미납·상태와 자동이체 여부를 표시", () => {
    render(<PaymentProcessingPage />);

    expect(screen.getByRole("columnheader", { name: "호실" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "부과금액" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "미납금액" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "상태" })).toBeInTheDocument();
    expect(screen.getByText("A동 101호")).toBeInTheDocument();
    expect(screen.getByText("100,000")).toBeInTheDocument();
    expect(screen.getByText("60,000")).toBeInTheDocument();
    expect(screen.getByText("부분납")).toBeInTheDocument();
    expect(screen.getByText("자동이체")).toBeInTheDocument();
    expect(usePaymentRows).toHaveBeenCalledWith(2, currentPeriod());
  });

  it("수납 모달 제출 시 당월 미납 전액을 기록", async () => {
    render(<PaymentProcessingPage />);

    fireEvent.click(screen.getByRole("button", { name: "수납" }));
    expect(screen.getByRole("dialog", { name: "수납 처리" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "수납 처리" }));

    await waitFor(() =>
      expect(recordPaymentAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          unitId: 21,
          period: currentPeriod(),
          amount: 60_000,
          kind: "full",
        }),
      ),
    );
    expect(usePaymentRows).toHaveBeenCalledWith(2, currentPeriod());
  });

  it("지로 액션은 전액 수납 모달의 방법을 giro로 프리셋", async () => {
    render(<PaymentProcessingPage />);

    fireEvent.click(screen.getByRole("button", { name: "지로" }));
    expect(screen.getByLabelText("수납방법")).toHaveValue("giro");
    fireEvent.click(screen.getByRole("button", { name: "수납 처리" }));

    await waitFor(() =>
      expect(recordPaymentAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          unitId: 21,
          period: currentPeriod(),
          amount: 60_000,
          method: "giro",
          kind: "full",
        }),
      ),
    );
  });
});
