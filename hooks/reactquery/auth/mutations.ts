import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login, logout, type LoginInput } from "./apis";
import { authKeys } from "./keys";

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: (ctx) => { qc.setQueryData(authKeys.me(), ctx); },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => { qc.clear(); },
  });
}
