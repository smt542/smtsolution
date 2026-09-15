import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/hooks/reactquery/accounts";
import type { AsCategory } from "@/hooks/reactquery/asCategories";
import type { Building } from "@/hooks/reactquery/buildings";

const dataMocks = vi.hoisted(() => ({ useUnits: vi.fn(), useOccupancies: vi.fn() }));
vi.mock("@/hooks/reactquery/units", () => ({ useUnits: dataMocks.useUnits }));
vi.mock("@/hooks/reactquery/occupancies", () => ({ useOccupancies: dataMocks.useOccupancies }));

import { AsComplaintForm } from "./AsComplaintForm";

const buildings = [{ id: 1, name: "한빛빌라" }] as Building[];
const categories = [{ id: 2, label: "배관" }] as AsCategory[];

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) {
  render(
    <AsComplaintForm
      open
      mode="create"
      editing={null}
      orgId={3}
      buildings={buildings}
      categories={categories}
      assignees={[] as Account[]}
      isPending={false}
      onClose={onClose}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit, onClose };
}

async function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("건물"), { target: { value: "1" } });
  await waitFor(() => expect(screen.getByLabelText("호수")).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText("호수"), { target: { value: "11" } });
  fireEvent.change(screen.getByLabelText("유형"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("접수내용"), { target: { value: " 싱크대 누수 " } });
}

beforeEach(() => {
  vi.clearAllMocks();
  dataMocks.useUnits.mockReturnValue({ data: [{ id: 11, unitNo: "101호", dong: "A동" }], isLoading: false });
  dataMocks.useOccupancies.mockReturnValue({ data: [] });
});

describe("AsComplaintForm form contract", () => {
  it("성공 시 식별자를 숫자로, 빈 선택을 nullable 값으로 변환해 제출한다", async () => {
    const { onSubmit, onClose } = renderForm();
    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 3,
      buildingId: 1,
      unitId: 11,
      categoryId: 2,
      content: "싱크대 누수",
      assignedTo: null,
      reporterPhone: null,
      status: "pending",
    }), null));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("검증 실패 시 첫 오류 필드에 포커스하고 ARIA로 연결한다", async () => {
    const { onSubmit } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    const building = screen.getByLabelText("건물");
    await waitFor(() => expect(building).toHaveFocus());
    expect(building).toHaveAttribute("aria-invalid", "true");
    expect(building.getAttribute("aria-describedby")).toMatch(/-building-error$/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("서버 실패는 전역 오류로 표시하고 닫지 않는다", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("A/S 저장 실패"));
    const { onClose } = renderForm(onSubmit);
    await fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A/S 저장 실패");
    expect(onClose).not.toHaveBeenCalled();
  });
});
