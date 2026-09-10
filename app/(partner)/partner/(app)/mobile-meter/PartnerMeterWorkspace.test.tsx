import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: mocks.createClient,
}));

import PartnerMeterWorkspace from "./PartnerMeterWorkspace";

const rows = [
  {
    unit_id: 11,
    unit_no: "201호",
    dong: "A동",
    tenant_name: "김주민",
    utility: "water",
    previous_reading: 10,
    current_reading: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createClient.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockImplementation((name: string) => {
    if (name === "partner_get_building") {
      return Promise.resolve({ data: [{ name: "해오름빌라" }], error: null });
    }
    if (name === "partner_list_meter_readings") {
      return Promise.resolve({ data: rows, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
});

describe("PartnerMeterWorkspace", () => {
  it("loads the browser-local current month and refetches for a selected month", async () => {
    render(<PartnerMeterWorkspace buildingId={7} />);

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    expect(screen.getByText("불러오는 중…")).toBeInTheDocument();
    await screen.findByText("해오름빌라");
    expect(screen.getByText("A동 201호")).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith("partner_get_building", { p_building_id: 7 });
    expect(mocks.rpc).toHaveBeenCalledWith("partner_list_meter_readings", {
      p_building_id: 7,
      p_period: `${currentMonth}-01`,
    });

    fireEvent.change(screen.getByLabelText("검침 년월"), { target: { value: "2026-02" } });

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith("partner_list_meter_readings", {
        p_building_id: 7,
        p_period: "2026-02-01",
      });
    });
  });

  it("keeps meter input and save payload in the client workspace", async () => {
    const user = userEvent.setup();
    render(<PartnerMeterWorkspace buildingId={7} />);

    await screen.findByText("해오름빌라");
    await user.click(screen.getByRole("button", { name: /A동 201호/ }));

    const readings = screen.getAllByPlaceholderText("0");
    fireEvent.change(readings[1], { target: { value: "25.5원" } });
    expect(readings[1]).toHaveValue("25.5");
    expect(screen.getByText("15.5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "저장" }));
    const saveButtons = screen.getAllByRole("button", { name: "저장" });
    await user.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith("partner_save_meter_readings", {
        p_building_id: 7,
        p_period: `${(screen.getByLabelText("검침 년월") as HTMLInputElement).value}-01`,
        p_readings: [
          { unit_id: 11, utility: "water", previous_reading: "10", current_reading: "25.5" },
          { unit_id: 11, utility: "elec", previous_reading: "", current_reading: "" },
          { unit_id: 11, utility: "gas", previous_reading: "", current_reading: "" },
        ],
      });
    });
  });

  it("preserves the missing-building state without calling RPCs", async () => {
    render(<PartnerMeterWorkspace buildingId={null} />);

    expect(await screen.findByText("세대 정보가 없어요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "뒤로" })).toHaveAttribute("href", "/partner/mobile-inquiry");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
