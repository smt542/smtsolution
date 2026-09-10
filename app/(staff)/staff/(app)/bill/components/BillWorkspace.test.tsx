import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({
  default: () => ({ type, companyName }: { type: string; companyName: string }) => (
    <div role="dialog">MODAL:{type}:{companyName}</div>
  ),
}));

import { BillWorkspace } from "./BillWorkspace";

describe("BillWorkspace", () => {
  it("문서 카드 4종을 노출하고 선택한 모달을 연다", () => {
    render(
      <BillWorkspace
        buildings={[{ id: 7, code: "B007", name: "행복빌라", address: "서울시" }]}
        companyName="한빛관리"
        accounts={[]}
        customerNotice={null}
      />,
    );

    expect(screen.getByRole("heading", { name: "서류 발행·출력" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /지로 고지서/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /조정명세서/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /자동이체 세대 출력/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /팩스 발송/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /A4 관리비 고지서/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /지로 고지서/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("MODAL:giro:한빛관리");
  });
});
