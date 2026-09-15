import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VendorCategory } from "@/hooks/reactquery/vendorCategories";

const vendorMocks = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock("@/components/common/ConfirmProvider", () => ({ useConfirm: () => vendorMocks.confirm }));
vi.mock("@/hooks/reactquery/attachments", () => ({ useAttachmentSignedUrls: () => [] }));

import { VendorFormModal } from "./VendorFormModal";

const categories = [{ id: 1, label: "전기" }] as VendorCategory[];

function renderModal({
  defaultCategoryId = 1 as number | null,
  onSubmit = vi.fn().mockResolvedValue(undefined),
  onClose = vi.fn(),
} = {}) {
  render(
    <VendorFormModal
      open
      editing={null}
      defaultCategoryId={defaultCategoryId}
      categories={categories}
      onSubmit={onSubmit}
      onClose={onClose}
      isPending={false}
    />,
  );
  return { onSubmit, onClose };
}

beforeEach(() => vi.clearAllMocks());

describe("VendorFormModal form contract", () => {
  it("성공 시 정규화한 값을 제출하고 닫는다", async () => {
    const { onSubmit, onClose } = renderModal();
    fireEvent.change(screen.getByLabelText("업체명"), { target: { value: " 한빛전기 " } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      name: "한빛전기",
      phone: null,
      bankAccount: null,
      memo: null,
      categoryId: 1,
    }, []));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("검증 실패 시 분류 필드에 포커스하고 ARIA로 오류를 연결한다", async () => {
    const { onSubmit } = renderModal({ defaultCategoryId: null });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    const category = screen.getByRole("combobox", { name: "구분" });
    await waitFor(() => expect(category).toHaveFocus());
    expect(category).toHaveAttribute("aria-invalid", "true");
    expect(category.getAttribute("aria-describedby")).toMatch(/-error$/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("서버 실패는 전역 오류로 표시하고 닫지 않는다", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("업체 저장 실패"));
    const { onClose } = renderModal({ onSubmit });
    fireEvent.change(screen.getByLabelText("업체명"), { target: { value: "한빛전기" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("업체 저장 실패");
    expect(onClose).not.toHaveBeenCalled();
  });
});
