import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const api = vi.hoisted(() => ({ login: vi.fn(), logout: vi.fn() }));
vi.mock("./apis", () => api);

import { authKeys } from "./keys";
import { useLogin } from "./mutations";

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("useLogin", () => {
  it("서버가 검증한 컨텍스트를 반환하고 me 캐시를 채운다", async () => {
    const context = {
      orgId: 1,
      role: "staff",
      orgStatus: "active",
      username: "hong",
      fullName: "홍길동",
      isActive: true,
      mustChangePassword: false,
      staffType: "manager_staff",
      permissions: ["buildings"],
    };
    api.login.mockResolvedValue(context);
    const input = { username: "hong", password: "pw", autoLogin: false };
    const { result } = renderHook(() => useLogin(), { wrapper });

    await expect(result.current.mutateAsync(input)).resolves.toEqual(context);
    expect(api.login).toHaveBeenCalledWith(input);
    expect(queryClient.getQueryData(authKeys.me())).toEqual(context);
  });

  it("서버의 로그인 거부 메시지를 그대로 전달한다", async () => {
    api.login.mockRejectedValue(new Error("비활성화된 계정입니다. 관리자에게 문의해 주세요."));
    const { result } = renderHook(() => useLogin(), { wrapper });

    await expect(result.current.mutateAsync({ username: "hong", password: "pw", autoLogin: false }))
      .rejects.toThrow("비활성화된 계정입니다. 관리자에게 문의해 주세요.");
  });
});
