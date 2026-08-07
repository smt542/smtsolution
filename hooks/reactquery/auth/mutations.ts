import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { login, logout, getMyContext, recordLogin, type LoginInput } from "./apis";
import { authKeys } from "./keys";

const NO_ACCESS = "접근 권한이 없는 계정입니다.";
const INACTIVE  = "비활성화된 계정입니다. 관리자에게 문의해 주세요.";
const SUSPENDED = "정지되었거나 사용할 수 없는 조직입니다.";

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      await login(input);
      const ctx = await getMyContext();
      const bail = async (msg: string) => { await createClient().auth.signOut(); throw new Error(msg); };
      if (!ctx) return bail(NO_ACCESS);
      if (!ctx.isActive) return bail(INACTIVE);
      if (ctx.orgStatus !== "active") return bail(SUSPENDED);
      await recordLogin();
      return ctx;
    },
    onSuccess: (ctx) => { qc.setQueryData(authKeys.me(), ctx); },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => { qc.setQueryData(authKeys.me(), null); qc.clear(); },
  });
}
