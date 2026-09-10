import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  workspace: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: mocks.rpc })),
}));

vi.mock("./PartnerAsNewWorkspace", () => ({
  default: (props: unknown) => {
    mocks.workspace(props);
    return <div>신규 접수 워크스페이스</div>;
  },
}));

import PartnerAsNewPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === "partner_list_buildings") {
      return { data: [{ id: 3, name: "해오름빌" }] };
    }
    if (name === "partner_list_as_categories") {
      return { data: [{ id: 7, label: "수도" }] };
    }
    return { data: [{ full_name: "홍길동" }] };
  });
});

it("fetches initial form data on the server and passes serializable props", async () => {
  render(await PartnerAsNewPage());

  expect(screen.getByText("신규 접수 워크스페이스")).toBeInTheDocument();
  expect(mocks.rpc).toHaveBeenCalledWith("partner_list_buildings");
  expect(mocks.rpc).toHaveBeenCalledWith("partner_list_as_categories");
  expect(mocks.rpc).toHaveBeenCalledWith("partner_get_profile");
  expect(mocks.workspace).toHaveBeenCalledWith({
    buildings: [{ id: 3, name: "해오름빌" }],
    cats: [{ id: 7, label: "수도" }],
    myName: "홍길동",
    today: expect.stringMatching(/^\d{4}\.\d{2}\.\d{2}$/),
  });
});
