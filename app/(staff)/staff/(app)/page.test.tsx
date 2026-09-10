import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));

import StaffHomePage from "./page";

describe("StaffHomePage", () => {
  it("대시보드 대신 수납관리·민원접수 화면으로 이동한다", () => {
    StaffHomePage();

    expect(redirect).toHaveBeenCalledWith("/staff/receipts");
  });
});
