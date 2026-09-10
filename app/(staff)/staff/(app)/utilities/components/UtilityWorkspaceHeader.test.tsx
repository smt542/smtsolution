import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UtilityWorkspaceHeader } from "./UtilityWorkspaceHeader";

describe("UtilityWorkspaceHeader", () => {
  it("전기 화면 기준의 공통 헤더 치수를 사용한다", () => {
    render(
      <UtilityWorkspaceHeader
        utilityLabel="수도"
        onOpenLedger={vi.fn()}
        onOpenCarryOver={vi.fn()}
      />,
    );

    expect(screen.getByRole("banner")).toHaveClass("h-[62px]", "gap-3", "px-6");
    expect(screen.getByRole("heading", { name: "수도" })).toHaveClass("text-[19px]", "mt-1");
    expect(screen.getByRole("button", { name: "메뉴 열기" })).toHaveClass("size-9", "rounded-[10px]");
    expect(screen.getByRole("button", { name: "검침대장 출력" })).toHaveClass("h-10", "rounded-[11px]");
    expect(screen.getByRole("button", { name: "전체 이월" })).toHaveClass("h-10", "rounded-[11px]");
  });

  it("출력과 이월 액션을 호출한다", () => {
    const onOpenLedger = vi.fn();
    const onOpenCarryOver = vi.fn();
    render(
      <UtilityWorkspaceHeader
        utilityLabel="가스"
        onOpenLedger={onOpenLedger}
        onOpenCarryOver={onOpenCarryOver}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "검침대장 출력" }));
    fireEvent.click(screen.getByRole("button", { name: "전체 이월" }));
    expect(onOpenLedger).toHaveBeenCalledOnce();
    expect(onOpenCarryOver).toHaveBeenCalledOnce();
  });
});
