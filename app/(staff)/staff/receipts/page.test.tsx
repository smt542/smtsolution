/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({ useBuildings: vi.fn() }));
vi.mock("@/hooks/reactquery/units", () => ({ useUnits: vi.fn() }));
vi.mock("@/hooks/reactquery/occupancies", () => ({ useOccupancies: vi.fn() }));
vi.mock("@/hooks/reactquery/asCategories", () => ({ useAsCategories: vi.fn() }));
vi.mock("@/hooks/reactquery/accounts", () => ({ useAccounts: vi.fn() }));
vi.mock("./components/PaymentStatusSection", () => ({
  PaymentStatusSection: () => <section><h1>수납관리·민원접수</h1><p>수납현황</p><button type="button">AS접수현황</button></section>,
}));
vi.mock("../messaging/components/MessagingModal", () => ({
  MessagingModal: ({ preset }: any) => (
    <div data-testid="messaging-preset">
      {preset.context}:{preset.recipients[0]?.name}:{preset.recipients[0]?.phone}
    </div>
  ),
}));
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
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import ReceiptManagementPage from "./page";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useUnits } from "@/hooks/reactquery/units";
import { useOccupancies } from "@/hooks/reactquery/occupancies";
import { useAsCategories } from "@/hooks/reactquery/asCategories";
import { useAccounts } from "@/hooks/reactquery/accounts";
import {
  useComplaints,
  useComplaintResolutions,
  useCreateComplaint,
  useUpdateComplaint,
  useUpdateComplaintStatus,
  useDeleteComplaint,
  useCreateComplaintResolution,
  useUpdateComplaintResolution,
  useDeleteComplaintResolution,
} from "@/hooks/reactquery/complaints";

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
const units = [
  { id: 21, buildingId: 2, unitNo: "101호", dong: "A동" },
  { id: 22, buildingId: 2, unitNo: "201호", dong: "A동" },
];
const categories = [
  { id: 4, orgId: 7, label: "수도", sortOrder: 1 },
  { id: 5, orgId: 7, label: "전기", sortOrder: 2 },
];
const assignees = [
  {
    userId: "worker-1",
    username: "worker",
    fullName: "박기사",
    phone: "010-2222-3333",
    phoneSub: null,
    role: "field",
    staffType: "field_staff",
    affiliation: "그린빌라",
    isActive: true,
    permissions: [],
    roleLabels: [],
  },
];
const resolution = {
  id: 91,
  complaintId: 11,
  resultContent: "수전 패킹 교체 완료",
  resultNotes: "재방문 불필요",
  resolvedBy: "worker-1",
  resolvedAt: "2026-08-12T03:00:00.000Z",
  createdAt: "2026-08-12T03:00:00.000Z",
  updatedAt: "2026-08-12T03:00:00.000Z",
};
const complaints = [
  {
    id: 11,
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
    receivedAt: "2026-08-12T00:00:00.000Z",
    completedAt: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    buildingName: "그린빌라",
    unitNo: "101호",
    unitDong: "A동",
    categoryLabel: "수도",
    resolutions: [resolution],
  },
  {
    id: 12,
    orgId: 7,
    buildingId: 3,
    unitId: null,
    categoryId: 5,
    title: "공용등 교체",
    content: "현관 공용등이 꺼졌습니다.",
    status: "completed",
    reporterName: "최입주",
    reporterPhone: "010-9876-5432",
    assignedTo: null,
    receivedAt: "2026-08-11T00:00:00.000Z",
    completedAt: "2026-08-11T02:00:00.000Z",
    createdAt: "2026-08-11T00:00:00.000Z",
    buildingName: "블루하우스",
    unitNo: null,
    unitDong: null,
    categoryLabel: "전기",
    resolutions: [],
  },
] as any[];

const createComplaintAsync = vi.fn();
const updateComplaintAsync = vi.fn();
const updateStatusAsync = vi.fn();
const deleteComplaintAsync = vi.fn();
const createResolutionAsync = vi.fn();
const updateResolutionAsync = vi.fn();
const deleteResolutionAsync = vi.fn();

function mutation(mutateAsync: ReturnType<typeof vi.fn>) {
  return { mutateAsync, isPending: false } as any;
}

function setup(me: any = master) {
  vi.mocked(useMe).mockReturnValue({ data: me } as any);
  vi.mocked(useBuildings).mockReturnValue({ data: buildings, isLoading: false } as any);
  vi.mocked(useUnits).mockReturnValue({ data: units, isLoading: false } as any);
  vi.mocked(useOccupancies).mockReturnValue({
    data: [{ id: 31, unitId: 21, tenantName: "김입주", phone: "010-1234-5678", status: "occupied" }],
    isLoading: false,
  } as any);
  vi.mocked(useAsCategories).mockReturnValue({ data: categories, isLoading: false } as any);
  vi.mocked(useAccounts).mockReturnValue({ data: assignees, isLoading: false } as any);
  vi.mocked(useComplaints).mockReturnValue({
    data: complaints,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as any);
  vi.mocked(useComplaintResolutions).mockReturnValue({
    data: [resolution],
    isLoading: false,
  } as any);
  vi.mocked(useCreateComplaint).mockReturnValue(mutation(createComplaintAsync));
  vi.mocked(useUpdateComplaint).mockReturnValue(mutation(updateComplaintAsync));
  vi.mocked(useUpdateComplaintStatus).mockReturnValue(mutation(updateStatusAsync));
  vi.mocked(useDeleteComplaint).mockReturnValue(mutation(deleteComplaintAsync));
  vi.mocked(useCreateComplaintResolution).mockReturnValue(mutation(createResolutionAsync));
  vi.mocked(useUpdateComplaintResolution).mockReturnValue(mutation(updateResolutionAsync));
  vi.mocked(useDeleteComplaintResolution).mockReturnValue(mutation(deleteResolutionAsync));
}

beforeEach(() => {
  vi.clearAllMocks();
  createComplaintAsync.mockResolvedValue(complaints[0]);
  updateComplaintAsync.mockResolvedValue(complaints[0]);
  updateStatusAsync.mockResolvedValue({ ...complaints[0], status: "completed" });
  deleteComplaintAsync.mockResolvedValue(undefined);
  createResolutionAsync.mockResolvedValue(resolution);
  updateResolutionAsync.mockResolvedValue(resolution);
  deleteResolutionAsync.mockResolvedValue(undefined);
  setup();
});

describe("ReceiptManagementPage", () => {
  it("complaints 권한이 없으면 데이터 화면 접근을 차단", () => {
    setup({ ...master, role: "staff", permissions: [] });
    render(<ReceiptManagementPage />);
    expect(screen.getByText("민원·AS 관리 권한이 없습니다")).toBeInTheDocument();
    expect(useComplaints).not.toHaveBeenCalled();
  });

  it("상태 요약과 실제 민원·AS 목록을 표시", () => {
    render(<ReceiptManagementPage />);
    expect(screen.getByRole("heading", { name: "수납관리·민원접수" })).toBeInTheDocument();
    expect(screen.getByText("수납현황")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AS접수현황" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "민원·AS 접수" })).toBeInTheDocument();
    expect(screen.getByText("욕실 수전 누수")).toBeInTheDocument();
    expect(screen.getByText("공용등 교체")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /전체\s*2/ })).toBeInTheDocument();
  });

  it("상태 필터를 복수 선택하고 통합검색으로 다시 좁힐 수 있음", () => {
    render(<ReceiptManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: /미결\s*1/ }));
    expect(screen.getByText("욕실 수전 누수")).toBeInTheDocument();
    expect(screen.queryByText("공용등 교체")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /완결\s*1/ }));
    expect(screen.getByText("공용등 교체")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("건물·호실·신고자·접수내용 검색"), {
      target: { value: "블루하우스" },
    });
    expect(screen.queryByText("욕실 수전 누수")).toBeNull();
    expect(screen.getByText("공용등 교체")).toBeInTheDocument();
  });

  it("건물·호실 선택 시 현재 입주자를 채우고 신규 접수", async () => {
    render(<ReceiptManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: /신규 접수/ }));

    fireEvent.change(screen.getByLabelText("건물"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("호실"), { target: { value: "21" } });
    await waitFor(() => expect(screen.getByLabelText("신고자 이름")).toHaveValue("김입주"));

    fireEvent.change(screen.getByLabelText("AS 구분"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("담당 기사"), { target: { value: "worker-1" } });
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "싱크대 누수" } });
    fireEvent.change(screen.getByLabelText("접수내용"), { target: { value: "배수관에서 물이 샙니다." } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(createComplaintAsync).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 7,
      buildingId: 2,
      unitId: 21,
      categoryId: 4,
      reporterName: "김입주",
      reporterPhone: "010-1234-5678",
      assignedTo: "worker-1",
      title: "싱크대 누수",
      content: "배수관에서 물이 샙니다.",
      status: "pending",
    })));
  });

  it("상세에서 상태 변경, 접수 수정, 소프트 삭제 동작을 호출", async () => {
    render(<ReceiptManagementPage />);
    fireEvent.click(screen.getByText("욕실 수전 누수"));
    expect(screen.getByRole("dialog", { name: "민원·AS 상세" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("처리 상태"), { target: { value: "completed" } });
    await waitFor(() => expect(updateStatusAsync).toHaveBeenCalledWith({ id: 11, status: "completed" }));

    fireEvent.click(screen.getByRole("button", { name: "접수 정보 수정" }));
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "욕실 수전 누수 재접수" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(updateComplaintAsync).toHaveBeenCalledWith(expect.objectContaining({
      id: 11,
      input: expect.objectContaining({ title: "욕실 수전 누수 재접수" }),
    })));

    fireEvent.click(screen.getByText("욕실 수전 누수"));
    fireEvent.click(screen.getByRole("button", { name: "접수 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
    await waitFor(() => expect(deleteComplaintAsync).toHaveBeenCalledWith(11));
  });

  it("처리이력을 추가·수정·삭제", async () => {
    render(<ReceiptManagementPage />);
    fireEvent.click(screen.getByText("욕실 수전 누수"));

    fireEvent.click(screen.getByRole("button", { name: /처리이력 추가/ }));
    fireEvent.change(screen.getByLabelText("처리 결과"), { target: { value: "밸브 교체 완료" } });
    fireEvent.click(screen.getByRole("button", { name: "처리이력 저장" }));
    await waitFor(() => expect(createResolutionAsync).toHaveBeenCalledWith(expect.objectContaining({
      complaintId: 11,
      resultContent: "밸브 교체 완료",
    })));

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByLabelText("처리 결과"), { target: { value: "수전 전체 교체" } });
    fireEvent.click(screen.getByRole("button", { name: "처리이력 저장" }));
    await waitFor(() => expect(updateResolutionAsync).toHaveBeenCalledWith(expect.objectContaining({
      id: 91,
      complaintId: 11,
      input: expect.objectContaining({ resultContent: "수전 전체 교체" }),
    })));

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제 확인" }));
    await waitFor(() => expect(deleteResolutionAsync).toHaveBeenCalledWith({
      id: 91,
      complaintId: 11,
    }));
  });

  it("담당 기사 문자 전송은 공용 메시징 프리셋을 연다", () => {
    render(<ReceiptManagementPage />);
    fireEvent.click(screen.getByText("욕실 수전 누수"));
    fireEvent.click(screen.getByRole("button", { name: "담당 기사 문자 전송" }));

    expect(screen.getByTestId("messaging-preset")).toHaveTextContent(
      "민원·AS 안내:박기사:010-2222-3333",
    );
  });
});
