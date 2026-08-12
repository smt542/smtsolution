// app/(staff)/staff/setup/components/AccountSettingsTab.test.tsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/setupConfig", () => ({ useSetupConfig: vi.fn(), useUpsertSetupConfig: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { AccountSettingsTab } from "./AccountSettingsTab";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig, useUpsertSetupConfig } from "@/hooks/reactquery/setupConfig";

const mutateAsync = vi.fn().mockResolvedValue({});
const fullConfig = { mgmtBank1:"국민", mgmtAcct1:"111", mgmtHolder1:"홍길동", mgmtPrint1:true,
  mgmtBank2:null, mgmtAcct2:null, mgmtHolder2:null, mgmtPrint2:false,
  settleBank:"신한", settleAcct:"222", settleHolder:"관리단" };
beforeEach(() => {
  vi.clearAllMocks(); mutateAsync.mockResolvedValue({});
  vi.mocked(useMe).mockReturnValue({ data: { orgId: 9 } } as unknown as ReturnType<typeof useMe>);
  vi.mocked(useUpsertSetupConfig).mockReturnValue({ mutateAsync, isPending: false } as unknown as ReturnType<typeof useUpsertSetupConfig>);
});

describe("AccountSettingsTab", () => {
  it("config로 초기화(계좌1·정산)", () => {
    vi.mocked(useSetupConfig).mockReturnValue({ data: fullConfig } as unknown as ReturnType<typeof useSetupConfig>);
    render(<AccountSettingsTab />);
    expect(screen.getByLabelText("관리비 은행 1")).toHaveValue("국민");
    expect(screen.getByLabelText("정산 예금주")).toHaveValue("관리단");
  });
  it("저장: 정산 계좌 변경 patch 전송", async () => {
    vi.mocked(useSetupConfig).mockReturnValue({ data: fullConfig } as unknown as ReturnType<typeof useSetupConfig>);
    render(<AccountSettingsTab />);
    fireEvent.change(screen.getByLabelText("정산 은행"), { target: { value: "우리" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        orgId: 9, patch: expect.objectContaining({ settleBank: "우리", mgmtBank1: "국민" }),
      }));
    });
  });
});
