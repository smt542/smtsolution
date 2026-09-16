import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchBillPageData: vi.fn(),
}));

vi.mock("../pageDataClient", () => ({
  fetchBillPageData: mocks.fetchBillPageData,
}));

vi.mock("next/dynamic", () => ({
  default: () => ({ type, companyName }: { type: string; companyName: string }) => (
    <div role="dialog">MODAL:{type}:{companyName}</div>
  ),
}));

import { BillWorkspace } from "./BillWorkspace";
import { DocumentCards } from "./DocumentCards";

const pageData = {
  buildings: [{ id: 7, code: "B007", name: "행복빌라", address: "서울시" }],
  companyName: "한빛관리",
  accounts: [],
  customerNotice: null,
};

function renderWorkspace(children: ReactNode = <DocumentCards />) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BillWorkspace>{children}</BillWorkspace>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchBillPageData.mockResolvedValue(pageData);
});

describe("BillWorkspace", () => {
  it("문서 카드 4종을 노출하고 데이터를 백그라운드에서 미리 불러온다", async () => {
    renderWorkspace();

    expect(screen.getByRole("button", { name: /지로 고지서/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /조정명세서/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /자동이체 세대 출력/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /팩스 발송/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /A4 관리비 고지서/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await waitFor(() => expect(mocks.fetchBillPageData).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /지로 고지서/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("MODAL:giro:한빛관리");
  });

  it("백그라운드 조회가 끝나지 않아도 메뉴를 보여주고 선택한 모달 안에서만 로딩한다", async () => {
    mocks.fetchBillPageData.mockReturnValue(new Promise(() => undefined));

    renderWorkspace(<><h1>서류 발행·출력</h1><DocumentCards /></>);

    expect(screen.getByRole("heading", { name: "서류 발행·출력" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /팩스 발송/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /팩스 발송/ }));

    expect(screen.getByRole("dialog", { name: "서류 발행 정보" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "서류 발행 정보 불러오는 중" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "서류 발행·출력" })).toBeInTheDocument();
  });
});
