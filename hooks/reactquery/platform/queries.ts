import { useQuery } from "@tanstack/react-query";
import {
  getPlatformOverview,
  listPlatformAccounts,
  listPlatformOrganizations,
} from "./apis";
import { platformKeys } from "./keys";

export function usePlatformOverview() {
  return useQuery({
    queryKey: platformKeys.overview(),
    queryFn: getPlatformOverview,
  });
}

export function usePlatformOrganizations() {
  return useQuery({
    queryKey: platformKeys.organizations(),
    queryFn: listPlatformOrganizations,
  });
}

export function usePlatformAccounts() {
  return useQuery({
    queryKey: platformKeys.accounts(),
    queryFn: listPlatformAccounts,
  });
}
