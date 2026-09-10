/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/units", () => ({ useUnits: vi.fn() }));
vi.mock("@/hooks/reactquery/occupancies", () => ({ useUnitOccupancyFull: vi.fn() }));
vi.mock("@/hooks/reactquery/org/useOrgContact", () => ({
  useOrgContact: () => ({ data: { phone: "02-1234-5678" } }),
}));
vi.mock("@/hooks/reactquery/payments", () => ({
  useUnitPayments: vi.fn(),
  useRecordPayment: vi.fn(),
  useRecordPaymentEdit: vi.fn(),
  useCancelPayment: vi.fn(),
}));
vi.mock("@/hooks/reactquery/receipts", () => ({
  useReceiptPaymentStatus: vi.fn(),
  useReceiptStatementData: vi.fn(),
  useSaveBuildingNotes: vi.fn(),
  useSaveOccupancyFields: vi.fn(),
}));
vi.mock("@/hooks/reactquery/asCategories", () => ({ useAsCategories: vi.fn() }));
vi.mock("@/hooks/reactquery/accounts", () => ({ useAccounts: vi.fn() }));
vi.mock("@/hooks/reactquery/movingSettlement", () => ({ useSettlementInquiry: vi.fn() }));
vi.mock("@/hooks/reactquery/complaints", () => ({
  useComplaints: vi.fn(),
  useComplaintResolutions: vi.fn(),
  useCreateComplaint: vi.fn(),
  useUpdateComplaint: vi.fn(),
  useUpdateComplaintStatus: vi.fn(),
  useDeleteComplaint: vi.fn(),
  useCreateComplaintResolution: vi.fn(),
  useUpdateComplaintResolution: vi.fn(),
  useDeleteComplaintResolution: vi.fn(),
}));
vi.mock("../messaging/components/MessagingModal", () => ({
  MessagingModal: () => <div data-testid="messaging-modal" />,
}));
vi.mock("./components/VillaPaymentModal", () => ({
  VillaPaymentModal: ({
    open,
    init,
  }: {
    open: boolean;
    init?: { view?: string };
  }) => open ? <div data-testid="villa-modal" data-view={init?.view} /> : null,
}));
vi.mock("./components/ChargeReceiptReportModal", () => ({
  ChargeReceiptReportModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="charge-report-modal" /> : null,
}));
vi.mock("./components/monthly/MonthlyChargeModal", () => ({
  MonthlyChargeModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="monthly-charge-modal" /> : null,
}));
vi.mock("./components/villa-receipts/VillaReceiptHistoryModal", () => ({
  VillaReceiptHistoryModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="villa-receipt-history-modal" /> : null,
}));
vi.mock("./components/unit-statement/UnitStatementModal", () => ({
  UnitStatementModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="unit-statement-modal" /> : null,
}));
vi.mock("./components/entry-alerts/ReceiptEntryAlerts", () => ({
  ReceiptEntryAlerts: () => null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { ReceiptWorkspace } from "./ReceiptWorkspace";
import railStyles from "./components/BuildingUnitRail.module.css";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useUnits } from "@/hooks/reactquery/units";
import { useUnitOccupancyFull } from "@/hooks/reactquery/occupancies";
import {
  useCancelPayment,
  useRecordPayment,
  useRecordPaymentEdit,
  useUnitPayments,
} from "@/hooks/reactquery/payments";
import {
  useReceiptPaymentStatus,
  useReceiptStatementData,
  useSaveBuildingNotes,
  useSaveOccupancyFields,
} from "@/hooks/reactquery/receipts";
import { useAsCategories } from "@/hooks/reactquery/asCategories";
import { useAccounts } from "@/hooks/reactquery/accounts";
import { useSettlementInquiry } from "@/hooks/reactquery/movingSettlement";
import {
  useComplaints,
  useCreateComplaint,
  useCreateComplaintResolution,
  useDeleteComplaint,
  useDeleteComplaintResolution,
  useUpdateComplaint,
  useUpdateComplaintResolution,
  useUpdateComplaintStatus,
} from "@/hooks/reactquery/complaints";

const master = { orgId: 7, role: "org_owner", permissions: [] } as any;

const buildings = [
  {
    id: 2,
    orgId: 7,
    code: "001",
    name: "그린빌라",
    address: "서울 강남 1",
    ownerName: "김소유",
    ownerPhone: "010-111-2222",
    memo: "정문 비번 1234",
    billingNote: null,
  },
  {
    id: 3,
    orgId: 7,
    code: "002",
    name: "블루하우스",
    address: "서울 강북 2",
    ownerName: null,
    ownerPhone: null,
    memo: null,
    billingNote: null,
  },
];
const units = [
  { id: 21, buildingId: 2, unitNo: "101호", dong: "A동", usageType: "residential" },
  { id: 22, buildingId: 2, unitNo: "201호", dong: "A동", usageType: "residential" },
];
const receiptRows = [
  {
    unitId: 21,
    buildingId: 2,
    buildingName: "그린빌라",
    dong: "A동",
    unitNo: "101호",
    tenantName: "김입주",
    phone: "010-1234-5678",
    charged: 150000,
    paid: 0,
    unpaid: 150000,
    dueDate: "2026-08-25",
    payStatus: "unpaid",
    occupancyId: 31,
    isVacant: false,
  },
];
const occFull = {
  unit: units[0],
  occupancy: {
    id: 31,
    unitId: 21,
    tenantName: "김입주",
    payerName: "김입주",
    phone: "010-1234-5678",
    moveInDate: "2025-01-01",
    moveOutDate: null,
    billingNote: "적요메모",
    settlementNote: null,
    facilityNote: null,
    transferMethod: "giro",
    billDelivery: "post",
    billingEnabled: true,
    printEnabled: true,
    smsOptIn: false,
    alimtalkOptIn: true,
    status: "occupied",
  },
  meters: [],
  accounts: [],
  lease: null,
  history: [],
};

const saveOccupancyFieldsAsync = vi.fn();
const saveBuildingNotesAsync = vi.fn();

function query(data: any) {
  return { data, isLoading: false, isError: false, refetch: vi.fn() } as any;
}
function mutation() {
  return { mutateAsync: vi.fn(), isPending: false } as any;
}

function renderPage({
  initialPeriod = null,
  initialBuildingId = null,
  initialUnitId = null,
}: {
  initialPeriod?: string | null;
  initialBuildingId?: number | null;
  initialUnitId?: number | null;
} = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReceiptWorkspace
        orgId={master.orgId}
        canSendMessages
        canEditPayment
        initialPeriod={initialPeriod}
        initialBuildingId={initialBuildingId}
        initialUnitId={initialUnitId}
      />
    </QueryClientProvider>,
  );
}

function setup() {
  vi.mocked(useBuildings).mockReturnValue(query(buildings));
  vi.mocked(useUnits).mockReturnValue(query(units));
  vi.mocked(useUnitOccupancyFull).mockReturnValue(query(occFull));
  vi.mocked(useUnitPayments).mockReturnValue(query([]));
  vi.mocked(useReceiptPaymentStatus).mockReturnValue({
    data: { rows: receiptRows, feeItems: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as any);
  vi.mocked(useAsCategories).mockReturnValue(query([]));
  vi.mocked(useAccounts).mockReturnValue(query([]));
  vi.mocked(useComplaints).mockReturnValue(query([]));
  vi.mocked(useSettlementInquiry).mockReturnValue(query([]));
  vi.mocked(useCreateComplaint).mockReturnValue(mutation());
  vi.mocked(useUpdateComplaint).mockReturnValue(mutation());
  vi.mocked(useUpdateComplaintStatus).mockReturnValue(mutation());
  vi.mocked(useDeleteComplaint).mockReturnValue(mutation());
  vi.mocked(useCreateComplaintResolution).mockReturnValue(mutation());
  vi.mocked(useUpdateComplaintResolution).mockReturnValue(mutation());
  vi.mocked(useDeleteComplaintResolution).mockReturnValue(mutation());
  vi.mocked(useRecordPayment).mockReturnValue(mutation());
  vi.mocked(useRecordPaymentEdit).mockReturnValue(mutation());
  vi.mocked(useCancelPayment).mockReturnValue(mutation());
  vi.mocked(useSaveBuildingNotes).mockReturnValue({
    mutateAsync: saveBuildingNotesAsync,
    isPending: false,
  } as any);
  vi.mocked(useReceiptStatementData).mockReturnValue({
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
  } as any);
  vi.mocked(useSaveOccupancyFields).mockReturnValue({
    mutateAsync: saveOccupancyFieldsAsync,
    isPending: false,
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  saveOccupancyFieldsAsync.mockResolvedValue(undefined);
  saveBuildingNotesAsync.mockResolvedValue(undefined);
  setup();
});

describe("ReceiptManagementPage (세대중심 재설계)", () => {
  it("서버에서 전달한 초기 건물·호실을 선택 상태로 사용한다", () => {
    renderPage({
      initialPeriod: "2026-08-01",
      initialBuildingId: 2,
      initialUnitId: 21,
    });

    expect(screen.getByText("입주자명")).toBeInTheDocument();
    expect(useUnitPayments).toHaveBeenCalledWith(21, "2026-08-01");
  });

  it("셸·건물 목록·조회 버튼과 미선택 안내를 렌더", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "수납관리·민원접수" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "조회" })).toBeInTheDocument();
    expect(screen.getByText("그린빌라")).toBeInTheDocument();
    expect(screen.getByText("블루하우스")).toBeInTheDocument();
    expect(screen.getByText("호수를 선택해 주세요")).toBeInTheDocument();
    expect(screen.getByLabelText("건물명·주소 검색")).toHaveClass("placeholder:text-[#757575]");
    expect(screen.getByText("호실을 선택하면 입주자정보가 표시돼요")).toHaveClass("text-t1");
    expect(screen.getByText("건물과 호수를 선택해 주세요")).toHaveClass("text-t1");
  });

  it("건물 선택 시 호실 목록, 호실 선택 시 입주자정보 표시", () => {
    renderPage();
    fireEvent.click(screen.getByText("그린빌라"));
    expect(screen.getByText("A동 101호")).toBeInTheDocument();

    fireEvent.click(screen.getByText("A동 101호"));
    expect(screen.queryByText("호실을 선택하면 입주자정보가 표시돼요")).toBeNull();
    expect(screen.getByText("입주자명")).toBeInTheDocument();
    expect(screen.getByText("적요메모")).toBeInTheDocument();
  });

  it("수납 추가 폼을 모달이 아닌 수납 이력 표 내부에 표시", () => {
    renderPage({
      initialPeriod: "2026-08-01",
      initialBuildingId: 2,
      initialUnitId: 21,
    });

    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    const editor = screen.getByTestId("payment-inline-editor");
    const historyPanel = editor.closest("section");
    expect(historyPanel).not.toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "처리" })).toBeInTheDocument();
    expect(within(editor).getByLabelText("수납액")).toBeInTheDocument();
    expect(within(editor).getByLabelText("수수료(수료)")).toBeInTheDocument();
    expect(within(editor).getByLabelText("수납일자")).toHaveAttribute("aria-haspopup", "dialog");
    expect(within(editor).getByLabelText("은행/방법")).toHaveAttribute("aria-haspopup", "listbox");
    expect(within(editor).getByLabelText("구분")).toHaveAttribute("aria-haspopup", "listbox");
    expect(within(editor).getByLabelText("비고")).toBeInTheDocument();
    expect(editor.querySelector('input[type="date"]')).not.toBeInTheDocument();
    expect(editor.querySelector("select")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "수납 이력 편집 취소" }));
    expect(screen.queryByTestId("payment-inline-editor")).not.toBeInTheDocument();
    expect(within(historyPanel!).getByRole("button", { name: "수정" })).toBeInTheDocument();
  });

  it("건물 선택 시 전체 목록 화면을 오른쪽 호실 화면으로 슬라이드", () => {
    renderPage();

    const track = screen.getByTestId("building-unit-view-track");
    expect(track).not.toHaveClass(railStyles.showUnitView);
    expect(screen.queryByRole("table", { name: "호실 목록" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("그린빌라"));
    expect(track).toHaveClass(railStyles.showUnitView);
    expect(screen.getByRole("table", { name: "호실 목록" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "건물 목록으로" }));
    expect(track).not.toHaveClass(railStyles.showUnitView);
    expect(screen.getByRole("table", { name: "건물 목록" })).toBeInTheDocument();
  });

  it("조회 버튼이 통합검색 모달을 연다", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "조회" }));
    expect(screen.getByRole("heading", { name: "조회 구간" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "입금자명으로 조회" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전화번호로 조회" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "동호로 조회" })).toBeInTheDocument();
  });

  it("입주자정보 수정→저장 시 useSaveOccupancyFields 호출 (P2 편집)", async () => {
    renderPage();
    fireEvent.click(screen.getByText("그린빌라"));
    fireEvent.click(screen.getByText("A동 101호"));

    const header = screen.getByRole("heading", { name: "입주자정보" }).parentElement as HTMLElement;
    fireEvent.click(within(header).getByRole("button", { name: "수정" }));
    fireEvent.click(within(header).getByRole("button", { name: "저장" }));

    await waitFor(() => expect(saveOccupancyFieldsAsync).toHaveBeenCalled());
    expect(saveOccupancyFieldsAsync).toHaveBeenCalledWith(
      expect.objectContaining({ occupancyId: 31, tenantName: "김입주" }),
    );
  });

  it("빌라 드롭다운이 Figma형 부과금액 리포트를 연다", () => {
    renderPage();
    fireEvent.click(screen.getByText("그린빌라"));
    fireEvent.click(screen.getByRole("button", { name: "빌라 부과금액" }));
    expect(screen.getByTestId("charge-report-modal")).toBeInTheDocument();
  });

  it("빌라 수납내역과 선택 호실 명세서를 각각 연다", () => {
    renderPage();
    fireEvent.click(screen.getByText("그린빌라"));
    fireEvent.click(screen.getByRole("button", { name: "빌라 수납내역" }));
    expect(screen.getByTestId("villa-receipt-history-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByText("A동 101호"));
    fireEvent.click(screen.getByRole("button", { name: "호실 명세서" }));
    expect(screen.getByTestId("unit-statement-modal")).toBeInTheDocument();
  });

  it("자동수납 메뉴가 지로 처리·원장·일자별 Figma 모달로 각각 진입한다", () => {
    renderPage();
    fireEvent.click(screen.getByText("그린빌라"));

    fireEvent.click(screen.getByRole("button", { name: "지로수납처리" }));
    expect(screen.getByTestId("villa-modal")).toHaveAttribute("data-view", "giro-upload");

    fireEvent.click(screen.getByRole("button", { name: "지로수납원장 보기" }));
    expect(screen.getByTestId("villa-modal")).toHaveAttribute("data-view", "giro");

    fireEvent.click(screen.getByRole("button", { name: "지로처리일자 확인" }));
    expect(screen.getByTestId("villa-modal")).toHaveAttribute("data-view", "giro-calendar");
  });
});
