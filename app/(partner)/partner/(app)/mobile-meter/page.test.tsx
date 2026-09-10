import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./PartnerMeterWorkspace", () => ({
  default: ({ buildingId }: { buildingId: number | null }) => (
    <div data-testid="meter-workspace">{buildingId == null ? "missing" : buildingId}</div>
  ),
}));

import PartnerMeterPage from "./page";

const renderPage = async (id?: string | string[]) =>
  render(
    <>
      {await PartnerMeterPage({
        searchParams: Promise.resolve({ id }),
      })}
    </>,
  );

describe("PartnerMeterPage", () => {
  it("passes the first finite id value to the client workspace", async () => {
    await renderPage(["7", "8"]);

    expect(screen.getByTestId("meter-workspace")).toHaveTextContent("7");
  });

  it.each([undefined, "", "invalid"])("passes null for an invalid id: %s", async (id) => {
    await renderPage(id);

    expect(screen.getByTestId("meter-workspace")).toHaveTextContent("missing");
  });

  it("preserves zero as a finite building id", async () => {
    await renderPage("0");

    expect(screen.getByTestId("meter-workspace")).toHaveTextContent("0");
  });
});
