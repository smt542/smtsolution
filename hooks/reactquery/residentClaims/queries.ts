import { useQuery } from "@tanstack/react-query";
import {
  listResidentClaims,
  residentAutomatch,
  residentMyLink,
  residentPendingContact,
  residentSearchBuildings,
} from "./apis";
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

export function useResidentPendingContact(enabled = true) {
  return useQuery({
    queryKey: residentClaimKeys.pendingContact(),
    queryFn: residentPendingContact,
    enabled,
  });
}

export function useResidentClaims(status?: ResidentClaimStatus) {
  return useQuery({
    queryKey: residentClaimKeys.list(status),
    queryFn: () => listResidentClaims(status),
  });
}

export function useResidentBuildingSearch(q?: string) {
  return useQuery({
    queryKey: residentClaimKeys.buildingSearch(q),
    queryFn: () => residentSearchBuildings(q),
  });
}
