import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { listAccounts } from "./apis";
import type { StaffType } from "@/hooks/reactquery/auth";
import { accountKeys } from "./keys";

export function useAccounts(params?: { search?: string; type?: StaffType }) {
  return useQuery({
    queryKey: accountKeys.list(params?.search, params?.type),
    queryFn: () => listAccounts(params),
    placeholderData: keepPreviousData,
  });
}
