import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ResidentTermsPage from "./page";

describe("ResidentTermsPage", () => {
  it("renders the terms body, the operator, and the back link", () => {
    render(<ResidentTermsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "이용약관" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "제1조 (목적)" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/에스엠티솔루션/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "제8조 (서비스 이용의 제한)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "내 정보로 돌아가기" }),
    ).toHaveAttribute("href", "/resident/me");
  });
});
