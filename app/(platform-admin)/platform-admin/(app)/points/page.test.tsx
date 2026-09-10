import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("./PointsWorkspace", () => ({
  default: () => <div>포인트 워크스페이스</div>,
}));

import PlatformPointsPage from "./page";

it("renders the client points workspace from the server page", () => {
  render(<PlatformPointsPage />);
  expect(screen.getByText("포인트 워크스페이스")).toBeInTheDocument();
});
