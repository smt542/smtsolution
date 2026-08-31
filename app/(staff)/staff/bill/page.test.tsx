import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/buildings", () => ({
  useBuildings: () => ({ data: [{ id: 7, orgId: 1, code: "B007", name: "행복빌라", address: "서울시" }], isLoading: false }),
}));
vi.mock("@/hooks/reactquery/setupConfig", () => ({ useSetupConfig: () => ({ data: null }) }));
vi.mock("@/hooks/reactquery/bill", () => ({ useBillOrganizationName: () => ({ data: "한빛관리" }) }));

import { useMe } from "@/hooks/reactquery/auth";
import BillPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("BillPage 게이트와 문서 선택", () => {
  it("bill_publish 권한이 없으면 차단한다", () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "field_staff", permissions: [] } } as unknown as ReturnType<typeof useMe>);
    render(<BillPage />);
    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
  });

  it("권한이 있으면 Figma 문서 카드 4종을 노출한다", () => {
    vi.mocked(useMe).mockReturnValue({ data: { role: "staff", orgId: 1, permissions: ["bill_publish"] } } as unknown as ReturnType<typeof useMe>);
    render(<BillPage />);
    expect(screen.getByRole("heading", { name: "서류 발행·출력" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /지로 고지서/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /조정명세서/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /자동이체 세대 출력/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /팩스 발송/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /A4 관리비 고지서/ })).not.toBeInTheDocument();
  });
});
