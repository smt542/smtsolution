import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createTemplate, deleteTemplate } = vi.hoisted(() => ({
  createTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}));

vi.mock("@/hooks/reactquery/messageTemplates", () => ({
  useMessageTemplates: () => ({
    data: [
      {
        id: 1,
        orgId: 9,
        title: "미납 안내",
        body: "#{이름}님 #{건물명} 관리비가 미납되었습니다.",
        sortOrder: 0,
        channelType: "sms",
        category: null,
        alimtalkTemplateCode: null,
        buttons: [],
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreateMessageTemplate: () => ({
    mutateAsync: createTemplate,
    isPending: false,
  }),
  useUpdateMessageTemplate: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteMessageTemplate: () => ({
    mutateAsync: deleteTemplate,
    isPending: false,
  }),
}));
vi.mock("@/hooks/reactquery/auth", () => ({
  useMe: () => ({ data: { orgId: 9 } }),
}));
vi.mock("@/hooks/common/useAppToast", () => ({
  appToast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { TemplatesTab } from "./TemplatesTab";

function renderTab(ui: ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      {ui}
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  createTemplate.mockResolvedValue({ id: 2 });
  deleteTemplate.mockResolvedValue(undefined);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("TemplatesTab", () => {
  it("템플릿 목록을 표시하고 사용자 템플릿에 삭제 버튼이 있다", () => {
    renderTab(<TemplatesTab />);

    expect(screen.getByText("미납 안내")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "미납 안내 삭제" }),
    ).toBeInTheDocument();
  });

  it("새 템플릿을 생성한다", async () => {
    renderTab(<TemplatesTab />);

    fireEvent.click(screen.getByRole("button", { name: "템플릿 등록" }));
    fireEvent.change(screen.getByLabelText("템플릿 제목"), {
      target: { value: "점검 안내" },
    });
    fireEvent.change(screen.getByLabelText("템플릿 본문"), {
      target: { value: "#{이름}님 점검 예정입니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(createTemplate).toHaveBeenCalledWith({
        orgId: 9,
        title: "점검 안내",
        body: "#{이름}님 점검 예정입니다.",
        category: null,
        channelType: "sms",
        alimtalkTemplateCode: null,
        buttons: [],
      }),
    );
  });

  it("템플릿을 삭제한다", async () => {
    renderTab(<TemplatesTab />);

    fireEvent.click(
      screen.getByRole("button", { name: "미납 안내 삭제" }),
    );
    await waitFor(() => expect(deleteTemplate).toHaveBeenCalledWith(1));
  });
});
