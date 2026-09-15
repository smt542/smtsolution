import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  usePlatformSettings: vi.fn(),
  useUpdatePlatformSettings: vi.fn(),
  refetch: vi.fn(),
  mutateAsync: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/reactquery/platform", () => ({
  usePlatformSettings: mocks.usePlatformSettings,
  useUpdatePlatformSettings: mocks.useUpdatePlatformSettings,
}));
vi.mock("@/hooks/common/useAppToast", () => ({
  appToast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));
vi.mock("../../../_components/PlatformShell", () => ({
  PlatformTopBarActions: ({ children }: { children: React.ReactNode }) => children,
}));

import { PlatformSettingsWorkspace } from "./PlatformSettingsWorkspace";

const settings = {
  id: 1,
  rateKrwAlimtalk: 10,
  rateKrwSms: 20,
  rateKrwLms: 30,
  rateKrwFax: 40,
  lowBalanceThreshold: 1000,
  billingBank: "관리은행",
  billingAccountNo: "123-456",
  billingAccountHolder: "관리비서",
  businessRegNo: "123-45-67890",
  invoiceNotice: "납부 안내",
  billingBasis: "매월 말일",
  paymentDueDays: 10,
  vatRate: 10,
  contactPerson: "김관리",
  updatedBy: null,
  updatedAt: "2026-09-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.usePlatformSettings.mockReturnValue({
    data: settings,
    isPending: false,
    isError: false,
    refetch: mocks.refetch,
  });
  mocks.useUpdatePlatformSettings.mockReturnValue({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
  });
  mocks.mutateAsync.mockResolvedValue(settings);
});

describe("PlatformSettingsWorkspace", () => {
  it("조회된 설정을 읽기 상태로 표시한다", () => {
    render(<PlatformSettingsWorkspace />);

    expect(screen.getByRole("heading", { name: "발송 단가 · 알림" })).toBeInTheDocument();
    expect(screen.getByText("관리은행")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "수정" })).toBeEnabled();
  });

  it("로딩 중에는 기존 Spinner를 표시한다", () => {
    mocks.usePlatformSettings.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: mocks.refetch,
    });

    const { container } = render(<PlatformSettingsWorkspace />);

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "발송 단가 · 알림" })).not.toBeInTheDocument();
  });

  it("조회 오류를 표시하고 다시 시도한다", () => {
    mocks.usePlatformSettings.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: mocks.refetch,
    });

    render(<PlatformSettingsWorkspace />);
    expect(screen.getByText("데이터를 불러오지 못했습니다.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it("편집한 설정을 기존 mutation payload로 저장한다", async () => {
    render(<PlatformSettingsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "문자(SMS)" }), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "담당자" }), {
      target: { value: "이관리" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ rateKrwSms: 25, contactPerson: "이관리" }),
    ));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("HQ 설정을 저장했습니다.");
    expect(screen.getByRole("button", { name: "수정" })).toBeInTheDocument();
  });

  it("편집 취소 시 조회값으로 돌아간다", () => {
    render(<PlatformSettingsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByRole("textbox", { name: "은행" }), {
      target: { value: "변경은행" },
    });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(screen.getByText("관리은행")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("변경은행")).not.toBeInTheDocument();
  });
});
