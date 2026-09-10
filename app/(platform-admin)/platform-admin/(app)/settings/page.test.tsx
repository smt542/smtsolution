import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./PlatformSettingsWorkspace", () => ({
  PlatformSettingsWorkspace: () => <div>PLATFORM_SETTINGS_WORKSPACE</div>,
}));

import PlatformSettingsPage from "./page";

describe("PlatformSettingsPage", () => {
  it("부모 Server 인증 아래에서 Client settings workspace를 렌더한다", () => {
    render(<PlatformSettingsPage />);

    expect(screen.getByText("PLATFORM_SETTINGS_WORKSPACE")).toBeInTheDocument();
  });
});
