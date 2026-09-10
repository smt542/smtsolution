import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("./OrganizationsWorkspace", () => ({
  default: () => <div>조직 목록 워크스페이스</div>,
}));

import PlatformOrganizationsPage from "./page";

it("renders the client organizations workspace from the server page", () => {
  render(<PlatformOrganizationsPage />);
  expect(screen.getByText("조직 목록 워크스페이스")).toBeInTheDocument();
});
