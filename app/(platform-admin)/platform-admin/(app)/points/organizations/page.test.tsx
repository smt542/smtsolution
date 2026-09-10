import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./OrganizationsPointsWorkspace", () => ({
  OrganizationsPointsWorkspace: () => <div>ORGANIZATIONS_POINTS_WORKSPACE</div>,
}));

import PlatformPointOrganizationsPage from "./page";

describe("PlatformPointOrganizationsPage", () => {
  it("부모 Server 인증 아래에서 Client workspace를 렌더한다", () => {
    render(<PlatformPointOrganizationsPage />);

    expect(screen.getByText("ORGANIZATIONS_POINTS_WORKSPACE")).toBeInTheDocument();
  });
});
