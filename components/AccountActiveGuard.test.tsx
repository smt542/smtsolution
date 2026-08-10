import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const signOut = vi.fn();
const replace = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/hooks/reactquery/auth", () => ({ useMe: vi.fn() }));

import { AccountActiveGuard } from "./AccountActiveGuard";
import { useMe } from "@/hooks/reactquery/auth";

beforeEach(() => vi.clearAllMocks());

describe("AccountActiveGuard", () => {
  it("활성 계정은 아무 동작 없음", () => {
    vi.mocked(useMe).mockReturnValue({ data: { isActive: true } } as never);
    render(<AccountActiveGuard />);
    expect(signOut).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("비활성 계정은 signOut + 로그인 이동", async () => {
    signOut.mockResolvedValue({});
    vi.mocked(useMe).mockReturnValue({ data: { isActive: false } } as never);
    render(<AccountActiveGuard />);
    // useEffect 실행 대기
    await Promise.resolve();
    expect(signOut).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/staff/login");
  });
});
