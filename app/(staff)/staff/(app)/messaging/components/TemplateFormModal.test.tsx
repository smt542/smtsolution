import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const createMutate = vi.fn().mockResolvedValue({});
const updateMutate = vi.fn().mockResolvedValue({});
vi.mock("@/hooks/reactquery/messageTemplates", () => ({
  useCreateMessageTemplate: () => ({ mutateAsync: createMutate, isPending: false }),
  useUpdateMessageTemplate: () => ({ mutateAsync: updateMutate, isPending: false }),
}));
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: () => ({ data: { orgId: 9 } }) }));
vi.mock("@/hooks/common/useAppToast", () => ({ appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { TemplateFormModal } from "./TemplateFormModal";

beforeEach(() => vi.clearAllMocks());

describe("TemplateFormModal 알림톡 필드", () => {
  it("채널=sms 기본이면 알림톡 필드 미표시", () => {
    render(<TemplateFormModal open onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByLabelText("알림톡 템플릿코드")).toBeNull();
  });

  it("채널=알림톡 선택 시 템플릿코드·버튼 입력 + 저장에 전달", async () => {
    render(<TemplateFormModal open onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("템플릿명"), { target: { value: "안내" } });
    fireEvent.change(screen.getByLabelText("템플릿 내용"), { target: { value: "본문" } });
    // 커스텀 드롭다운으로 채널 = 알림톡 선택
    fireEvent.click(screen.getByRole("button", { name: "채널 유형" }));
    fireEvent.click(screen.getByRole("button", { name: "알림톡" }));
    fireEvent.change(screen.getByLabelText("알림톡 템플릿코드"), { target: { value: "T10" } });
    fireEvent.change(screen.getByLabelText("버튼명"), { target: { value: "확인" } });
    fireEvent.change(screen.getByLabelText("연결 URL"), { target: { value: "https://x" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const arg = createMutate.mock.calls[0][0];
    expect(arg).toMatchObject({
      orgId: 9, title: "안내", body: "본문", channelType: "alimtalk", alimtalkTemplateCode: "T10",
    });
    expect(arg.buttons[0]).toMatchObject({ name: "확인", type: "WL", url: "https://x" });
  });
});
