import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createAccount, updateAccountBasic, updatePermissions, setActive, resetPassword,
  type AccountCreateInput, type AccountBasicInput, type PermissionInput,
} from "./apis";
import { accountKeys } from "./keys";

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: AccountCreateInput) => createAccount(i),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: accountKeys.all }),
      qc.invalidateQueries({ queryKey: accountKeys.loginPins() }),
    ]),
  });
}
export function useUpdateAccountBasic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: AccountBasicInput }) => updateAccountBasic(userId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
export function useUpdatePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: PermissionInput }) => updatePermissions(userId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
export function useSetActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) => setActive(userId, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) => resetPassword(userId, password),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.loginPins() }),
  });
}
