import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Building } from "@/hooks/reactquery/buildings";

const noticeMocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/reactquery/notices", () => ({
  useCreateNotice: () => ({ mutateAsync: noticeMocks.create, isPending: false }),
  useUpdateNotice: () => ({ mutateAsync: noticeMocks.update, isPending: false }),
  // 이미지 없는 저장 경로: content_json을 그대로 통과시키고 부수효과는 no-op.
  prepareNoticeImages: vi.fn(async ({ doc }: { doc: unknown }) => ({
    nextDoc: doc,
    uploaded: [],
    failedCount: 0,
  })),
  finalizeNoticeImages: vi.fn(async () => ({ rowFailedCount: 0 })),
  removeNoticeImageObjects: vi.fn(async () => {}),
}));
vi.mock("@/hooks/common/useAppToast", () => ({
  appToast: { success: noticeMocks.toastSuccess, error: noticeMocks.toastError },
}));
vi.mock("@/components/notices/NoticeEditor", () => ({
  NoticeEditor: ({ onChange }: { onChange: (doc: unknown) => void }) => (
    <textarea
      aria-label="내용"
      onChange={(event) =>
        onChange({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: event.target.value ? [{ type: "text", text: event.target.value }] : [],
            },
          ],
        })
      }
    />
  ),
}));

import { NoticeFormModal } from "./NoticeFormModal";

const savedNotice = { id: 9, title: "안내", content: "내용", publishedAt: null };

function renderModal(onClose = vi.fn(), onSaved = vi.fn()) {
  render(
    <NoticeFormModal
      open
      editing={null}
      buildings={[{ id: 1, name: "한빛빌라" } as Building]}
      orgId={3}
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
  return { onClose, onSaved };
}

beforeEach(() => {
  vi.clearAllMocks();
  noticeMocks.create.mockResolvedValue(savedNotice);
  noticeMocks.update.mockResolvedValue(savedNotice);
});

describe("NoticeFormModal form contract", () => {
  it("성공 시 변환된 값을 저장하고 닫는다", async () => {
    const { onClose, onSaved } = renderModal();
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: " 안내 " } });
    fireEvent.change(screen.getByLabelText(/내용/), { target: { value: " 공지 내용 " } });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    await waitFor(() => expect(noticeMocks.create).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 3,
      buildingIds: [],
      title: "안내",
      content: "공지 내용",
      expiresAt: null,
      publishedAt: expect.any(String),
    })));
    expect(onSaved).toHaveBeenCalledWith(savedNotice);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("검증 실패 시 첫 오류 필드에 포커스하고 ARIA로 연결한다", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    const title = screen.getByLabelText(/제목/);
    await waitFor(() => expect(title).toHaveFocus());
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveAttribute("aria-describedby", "notice-title-error");
    expect(noticeMocks.create).not.toHaveBeenCalled();
  });

  it("서버 실패는 전역 오류로 표시하고 닫지 않는다", async () => {
    noticeMocks.create.mockRejectedValue(new Error("공지 저장 실패"));
    const { onClose } = renderModal();
    fireEvent.change(screen.getByLabelText(/제목/), { target: { value: "안내" } });
    fireEvent.change(screen.getByLabelText(/내용/), { target: { value: "공지 내용" } });
    fireEvent.click(screen.getByRole("button", { name: "등록" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("공지 저장 실패");
    expect(onClose).not.toHaveBeenCalled();
  });
});
