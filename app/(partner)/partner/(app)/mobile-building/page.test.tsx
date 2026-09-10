import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPartnerBuildingPageData: vi.fn(),
}));

vi.mock("./data", () => ({
  getPartnerBuildingPageData: mocks.getPartnerBuildingPageData,
}));

import PartnerBuildingPage from "./page";

const building = {
  id: 7,
  code: "B-007",
  name: "해오름빌라",
  address: "서울시 중구",
  memo: "공동현관 확인",
  building_type: "다가구",
  entrance_password: "1234",
  owner_name: "홍길동",
  owner_phone: "010-1234-5678",
};

const units = [
  {
    unit_id: 11,
    unit_no: "201호",
    dong: "A동",
    tenant_name: "김주민",
    phone: "010-0000-0000",
    move_in_date: "2026-01-01",
    status: "occupied",
  },
];

const vendors = [
  {
    id: 21,
    vendor_type: "elevator",
    name: "안전승강기",
    phone: "02-123-4567",
    memo: null,
  },
];

const renderPage = async (id?: string | string[]) =>
  render(
    <>
      {await PartnerBuildingPage({
        searchParams: Promise.resolve({ id }),
      })}
    </>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPartnerBuildingPageData.mockResolvedValue({
    building,
    units,
    vendors,
  });
});

describe("PartnerBuildingPage", () => {
  it("parses the first id value and renders server-loaded building data", async () => {
    await renderPage(["7", "8"]);

    expect(mocks.getPartnerBuildingPageData).toHaveBeenCalledWith(7);
    expect(screen.getAllByText("해오름빌라")).toHaveLength(2);
    expect(screen.getByText("안전승강기")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "검침 자료" })).toHaveAttribute(
      "href",
      "/partner/mobile-meter?id=7",
    );
  });

  it("keeps tab interaction in the client workspace", async () => {
    const user = userEvent.setup();
    await renderPage("7");

    await user.click(screen.getByRole("button", { name: /입주자 정보/ }));
    expect(screen.getByText("A동 201호")).toBeInTheDocument();
    expect(screen.getByText("김주민")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /A동 201호/ })).toHaveAttribute(
      "href",
      "/partner/mobile-tenant?id=11",
    );
  });

  it("does not call RPCs for an invalid id and preserves the missing state", async () => {
    await renderPage("invalid");

    expect(mocks.getPartnerBuildingPageData).not.toHaveBeenCalled();
    expect(screen.getByText("건물 정보를 찾을 수 없어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "검침 자료" })).toHaveAttribute(
      "href",
      "/partner/mobile-meter",
    );
  });
});
