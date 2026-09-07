import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ResidentPrivacyPage from "./page";

describe("ResidentPrivacyPage", () => {
  it("renders the privacy policy, the operator, and the back link", () => {
    render(<ResidentPrivacyPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "개인정보 처리방침" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/에스엠티솔루션/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "6. 정보주체의 권리와 행사 방법" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "내 정보로 돌아가기" }),
    ).toHaveAttribute("href", "/resident/me");
  });
});
