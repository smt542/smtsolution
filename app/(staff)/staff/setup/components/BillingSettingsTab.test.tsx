import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));
vi.mock("@/hooks/reactquery/setupConfig", () => ({ useSetupConfig: vi.fn(), useUpsertSetupConfig: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { BillingSettingsTab } from "./BillingSettingsTab";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig, useUpsertSetupConfig } from "@/hooks/reactquery/setupConfig";

const mutateAsync = vi.fn().mockResolvedValue({});
beforeEach(() => {
  vi.clearAllMocks();
  mutateAsync.mockResolvedValue({});
  vi.mocked(useMe).mockReturnValue({ data: { orgId: 9 } } as any);
  vi.mocked(useUpsertSetupConfig).mockReturnValue({ mutateAsync, isPending: false } as any);
});

describe("BillingSettingsTab", () => {
  it("config 값으로 폼 초기화", () => {
    vi.mocked(useSetupConfig).mockReturnValue({ data: { customerNotice:"안내문", unitLabelDefault:"name",
      lateFeeMerge:false, printUtilityCutoff:false, printWaterUnitPrice:false, printBillingPeriod:false,
      printDelta:false, showAsOnMain:false, cutoffMonths:3 } } as any);
    render(<BillingSettingsTab />);
    expect(screen.getByLabelText("고객 안내사항")).toHaveValue("안내문");
    expect(screen.getByLabelText("세대 표기 방식 기본값")).toHaveValue("name");
    expect(screen.getByLabelText("단수 개월 수")).toHaveValue(3);
  });
  it("저장: upsert(orgId, patch) + 성공 토스트", async () => {
    vi.mocked(useSetupConfig).mockReturnValue({ data: null } as any);
    render(<BillingSettingsTab />);
    fireEvent.change(screen.getByLabelText("고객 안내사항"), { target: { value: "새 안내" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
        orgId: 9, patch: expect.objectContaining({ customerNotice: "새 안내", unitLabelDefault: "code" }),
      }));
    });
  });
});
