import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TenantLayout from "./layout";

describe("TenantLayout", () => {
  it("서버 params로 건물정보와 입주자 관리 탭을 구성한다", async () => {
    render(
      await TenantLayout({
        children: <div>CONTENT</div>,
        params: Promise.resolve({ id: "7" }),
      }),
    );

    expect(screen.getByRole("link", { name: "건물정보" })).toHaveAttribute("href", "/staff/buildings/7");
    expect(screen.getByRole("link", { name: "입주자 관리" })).toHaveAttribute("href", "/staff/buildings/7/tenants");
    expect(screen.getByRole("link", { name: "입주자 관리" })).toHaveClass("bg-brand", "text-white");
    expect(screen.getByText("CONTENT")).toBeInTheDocument();
  });
});
