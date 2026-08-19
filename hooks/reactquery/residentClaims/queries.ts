import { useQuery } from "@tanstack/react-query";
import { listResidentClaims, residentAutomatch, residentMyLink } from "./apis";
import type { ResidentClaimStatus } from "./apis";
import { residentClaimKeys } from "./keys";

export function useResidentAutomatch() {
  return useQuery({
    queryKey: residentClaimKeys.automatch(),
    queryFn: residentAutomatch,
  });
}

export function useResidentMyLink() {
  return useQuery({
    queryKey: residentClaimKeys.myLink(),
    queryFn: residentMyLink,
  });
}

export function useResidentClaims(status?: ResidentClaimStatus) {
  return useQuery({
    queryKey: residentClaimKeys.list(status),
    queryFn: () => listResidentClaims(status),
  });
}
