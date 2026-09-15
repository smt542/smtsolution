import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/common/ConfirmProvider", () => ({ useConfirm: () => vi.fn() }));
vi.mock("@/hooks/reactquery/platform", () => ({
  useOrganizationContractFilePreview: () => ({ data: null, isError: false }),
}));

import { OrgFormModal } from "./OrgFormModal";

function fillCreateForm() {
  const values: Array<[string | RegExp, string]> = [
    [/계약 시작일/, "2026-09-01"],
    [/계약 만료일/, "2027-08-31"],
    [/상호/, " 한빛관리 "],
    [/회사코드/, "HANBIT-01"],
    [/지역/, "서울"],
    [/대표자/, "홍길동"],
    [/사업자등록번호/, "123-45-67890"],
    [/대표 전화/, "02-1234-5678"],
    [/팩스 번호/, "02-1234-5679"],
    [/이메일/, "admin@example.com"],
    [/주소/, "서울시 중구"],
    [/관리자 아이디/, "owner"],
    [/관리자 이름/, "관리자"],
  ];
  values.forEach(([label, value]) => fireEvent.change(screen.getByLabelText(label), { target: { value } }));
}

function renderCreate(onSubmit = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) {
  render(<OrgFormModal mode="create" open onClose={onClose} onSubmit={onSubmit} isPending={false} />);
  return { onSubmit, onClose };
}

describe("OrgFormModal form contract", () => {
  it("생성 성공 시 정규화한 값을 제출하고 reset 후 닫는다", async () => {
    const { onSubmit, onClose } = renderCreate();
    fillCreateForm();
    fireEvent.click(screen.getByRole("button", { name: "입점 등록" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: "한빛관리",
      slug: "hanbit-01",
      contractFile: null,
    })));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("검증 실패 시 첫 오류 필드에 포커스하고 ARIA로 연결한다", async () => {
    const { onSubmit } = renderCreate();
    fireEvent.click(screen.getByRole("button", { name: "입점 등록" }));
    const startDate = screen.getByLabelText(/계약 시작일/);
    await waitFor(() => expect(startDate).toHaveFocus());
    expect(startDate).toHaveAttribute("aria-invalid", "true");
    expect(startDate).toHaveAttribute("aria-describedby", "create-org-contractStartDate-error");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("서버 실패를 전역 오류로 표시하고 입력과 모달을 유지한다", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("회사코드 중복"));
    const { onClose } = renderCreate(onSubmit);
    fillCreateForm();
    fireEvent.click(screen.getByRole("button", { name: "입점 등록" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("회사코드 중복");
    expect(screen.getByLabelText(/상호/)).toHaveValue(" 한빛관리 ");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("수정 모드는 전달된 defaultValues로 초기화한다", () => {
    render(<OrgFormModal
      mode="edit"
      open
      onClose={vi.fn()}
      onSubmit={vi.fn()}
      isPending={false}
      defaultContractFilePath={null}
      defaultValues={{
        name: "기존 회사", slug: "existing", phone: "02-1", contractStartDate: "2026-01-01",
        contractEndDate: "2026-12-31", representativeName: "대표", businessRegistrationNumber: "123-45-67890",
        fax: "02-2", email: "a@example.com", address: "주소", region: "서울", operatingHours: "",
      }}
    />);
    expect(screen.getByLabelText(/상호/)).toHaveValue("기존 회사");
  });
});
