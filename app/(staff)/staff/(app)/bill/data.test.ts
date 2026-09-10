import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  buildingsOrder: vi.fn(),
  organizationMaybeSingle: vi.fn(),
  configMaybeSingle: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { getBillPageData } from "./data";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockResolvedValue({ from: mocks.from });
  mocks.from.mockImplementation((table: string) => {
    if (table === "buildings") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({ order: mocks.buildingsOrder })),
          })),
        })),
      };
    }
    if (table === "organizations") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: mocks.organizationMaybeSingle })),
        })),
      };
    }
    if (table === "setup_config") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: mocks.configMaybeSingle })),
        })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });
  mocks.buildingsOrder.mockResolvedValue({ data: [], error: null });
  mocks.organizationMaybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.configMaybeSingle.mockResolvedValue({ data: null, error: null });
});

describe("getBillPageData", () => {
  it("출력에 필요한 최소 건물·회사·계좌 설정만 직렬화 가능한 형태로 반환한다", async () => {
    mocks.buildingsOrder.mockResolvedValue({
      data: [{ id: 7, code: "B007", name: "행복빌라", address: "서울시" }],
      error: null,
    });
    mocks.organizationMaybeSingle.mockResolvedValue({ data: { name: "한빛관리" }, error: null });
    mocks.configMaybeSingle.mockResolvedValue({
      data: {
        customer_notice: "납기일을 확인해 주세요.",
        mgmt_bank1: "국민",
        mgmt_acct1: "123-456",
        mgmt_holder1: "한빛관리",
        mgmt_print1: true,
        mgmt_bank2: "신한",
        mgmt_acct2: "999-000",
        mgmt_holder2: "한빛관리",
        mgmt_print2: false,
      },
      error: null,
    });

    await expect(getBillPageData(1)).resolves.toEqual({
      buildings: [{ id: 7, code: "B007", name: "행복빌라", address: "서울시" }],
      companyName: "한빛관리",
      accounts: [{ bank: "국민", acct: "123-456", holder: "한빛관리" }],
      customerNotice: "납기일을 확인해 주세요.",
    });
    expect(mocks.from).toHaveBeenCalledWith("buildings");
    expect(mocks.from).toHaveBeenCalledWith("organizations");
    expect(mocks.from).toHaveBeenCalledWith("setup_config");
  });

  it("조직명과 설정 행이 없으면 기존 기본값을 유지한다", async () => {
    await expect(getBillPageData(1)).resolves.toEqual({
      buildings: [],
      companyName: "관리비서",
      accounts: [],
      customerNotice: null,
    });
  });

  it("서버 조회 오류를 전달한다", async () => {
    mocks.buildingsOrder.mockResolvedValue({ data: null, error: { message: "buildings failed" } });

    await expect(getBillPageData(1)).rejects.toThrow("buildings failed");
  });
});
