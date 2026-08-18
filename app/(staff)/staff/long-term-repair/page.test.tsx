import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useMeMock } = vi.hoisted(() => ({ useMeMock: vi.fn() }));

vi.mock("@/hooks/reactquery/auth", () => ({ useMe: useMeMock }));
vi.mock("@/hooks/reactquery/buildings", () => ({
  useBuildings: () => ({ data: [{ id: 3, orgId: 9, code: "B001", name: "한빛빌딩" }], isLoading: false }),
}));
vi.mock("@/hooks/reactquery/bill", () => ({
  useBillOrganizationName: () => ({ data: "한빛관리" }),
}));
vi.mock("./components/LongTermRepairLedger", () => ({
  LongTermRepairLedger: ({ companyName }: { companyName: string }) => <div>LEDGER:{companyName}</div>,
}));

import LongTermRepairPage from "./page";

beforeEach(() => vi.clearAllMocks());

describe("LongTermRepairPage", () => {
  it("settings 권한 없는 일반 계정의 접근을 차단한다", () => {
    useMeMock.mockReturnValue({ data: { orgId: 9, role: "staff", permissions: [] } });

    render(<LongTermRepairPage />);

    expect(screen.getByText(/접근할 권한이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/LEDGER/)).toBeNull();
  });

  it("마스터는 별도 권한 없이 원장 화면을 사용한다", () => {
    useMeMock.mockReturnValue({ data: { orgId: 9, role: "org_owner", permissions: [] } });

    render(<LongTermRepairPage />);

    expect(screen.getByText("LEDGER:한빛관리")).toBeInTheDocument();
  });

  it("settings 권한 일반 계정도 원장 화면을 사용한다", () => {
    useMeMock.mockReturnValue({ data: { orgId: 9, role: "staff", permissions: ["settings"] } });

    render(<LongTermRepairPage />);

    expect(screen.getByText("LEDGER:한빛관리")).toBeInTheDocument();
  });
});
