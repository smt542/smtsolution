import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

import PartnerLoginPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PartnerLoginPage", () => {
  it("Server shell의 브랜딩과 문의 문구, Client form을 함께 표시한다", () => {
    render(<PartnerLoginPage />);

    expect(screen.getByRole("img", { name: "관리비서" })).toBeInTheDocument();
    expect(screen.getByLabelText("아이디")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
    expect(screen.getByText(/문의 : 042-632-8770/)).toBeInTheDocument();
  });

  it("저장된 자동 로그인 아이디를 마운트 후 복원한다", async () => {
    localStorage.setItem("erp_partner_login_auto", "field-user");
    render(<PartnerLoginPage />);

    await waitFor(() => expect(screen.getByLabelText("아이디")).toHaveValue("field-user"));
    expect(screen.getByRole("checkbox", { name: "자동 로그인" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("로그인 API payload와 자동 로그인 저장, 이동 동작을 유지한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<PartnerLoginPage />);

    fireEvent.change(screen.getByLabelText("아이디"), { target: { value: " field-user " } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "자동 로그인" }));
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/partner/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "field-user", password: "1234" }),
    }));
    expect(localStorage.getItem("erp_partner_login_auto")).toBe("field-user");
    expect(mocks.replace).toHaveBeenCalledWith("/partner/mobile-home");
  });
});
