import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listAccountLoginPins, listAccounts } from "./apis";
import type { StaffType } from "@/hooks/reactquery/auth";
import { useMe } from "@/hooks/reactquery/auth/queries";
import { canManageAccounts } from "@/lib/auth/permissions";
import { accountKeys } from "./keys";

export function useAccounts(params?: { search?: string; type?: StaffType }) {
  return useQuery({
    queryKey: accountKeys.list(params?.search, params?.type),
    queryFn: () => listAccounts(params),
    placeholderData: keepPreviousData,
  });
}

export function useAccountLoginPins() {
  const { data: me } = useMe();
  const enabled = canManageAccounts(me);

  return useQuery({
    queryKey: accountKeys.loginPins(),
    queryFn: listAccountLoginPins,
    enabled,
    staleTime: 60_000,
  });
}
