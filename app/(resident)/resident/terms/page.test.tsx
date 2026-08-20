import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ResidentTermsPage from "./page";

describe("ResidentTermsPage", () => {
  it("renders the terms body, a legal-review marker, and the back link", () => {
    render(<ResidentTermsPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "이용약관" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "세입자 서비스 이용약관" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/법무 검토/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "제8조 (회원 탈퇴)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "내 정보로 돌아가기" }),
    ).toHaveAttribute("href", "/resident/me");
  });
});
