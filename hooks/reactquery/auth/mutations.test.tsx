import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const api = vi.hoisted(() => ({
  login: vi.fn(), logout: vi.fn(), getMyContext: vi.fn(), recordLogin: vi.fn(),
}));
vi.mock("./apis", () => api);
const signOut = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));

import { useLogin } from "./mutations";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe("useLogin", () => {
  it("성공: 활성 조직 컨텍스트면 recordLogin 호출", async () => {
    api.login.mockResolvedValue(undefined);
    api.getMyContext.mockResolvedValue({ orgId: 1, role: "staff", orgStatus: "active", username: "hong", fullName: "홍", isActive: true, mustChangePassword: false });
    api.recordLogin.mockResolvedValue(undefined);
    const { result } = renderHook(() => useLogin(), { wrapper });
    await result.current.mutateAsync({ username: "hong", password: "pw", autoLogin: false });
    expect(api.recordLogin).toHaveBeenCalled();
  });

  it("컨텍스트 없음: 권한 없음 에러 + signOut", async () => {
    api.login.mockResolvedValue(undefined);
    api.getMyContext.mockResolvedValue(null);
    const { result } = renderHook(() => useLogin(), { wrapper });
    await expect(result.current.mutateAsync({ username: "x", password: "y", autoLogin: false }))
      .rejects.toThrow("접근 권한이 없는 계정입니다.");
    expect(signOut).toHaveBeenCalled();
  });

  it("정지 조직: 차단 + signOut", async () => {
    api.login.mockResolvedValue(undefined);
    api.getMyContext.mockResolvedValue({ orgId: 1, role: "staff", orgStatus: "suspended", username: "h", fullName: "홍", isActive: true, mustChangePassword: false });
    const { result } = renderHook(() => useLogin(), { wrapper });
    await expect(result.current.mutateAsync({ username: "x", password: "y", autoLogin: false }))
      .rejects.toThrow("정지되었거나 사용할 수 없는 조직입니다.");
    expect(signOut).toHaveBeenCalled();
  });
});
