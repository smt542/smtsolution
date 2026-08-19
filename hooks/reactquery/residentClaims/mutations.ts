import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  approveResidentClaim,
  rejectResidentClaim,
  residentConfirm,
  residentRequestClaim,
  stubResidentKakaoLogin,
} from "./apis";
import type { ResidentStubLoginInput } from "./apis";
import { residentClaimKeys } from "./keys";

export function useStubResidentKakaoLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResidentStubLoginInput = {}) => stubResidentKakaoLogin(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: residentClaimKeys.all }),
  });
}

export function useResidentConfirm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (occupancyId: number) => residentConfirm(occupancyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: residentClaimKeys.all }),
  });
}

export function useResidentRequestClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { buildingId: number; unitText: string }) => residentRequestClaim(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: residentClaimKeys.all }),
  });
}

export function useApproveResidentClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { claimId: number; occupancyId: number }) => approveResidentClaim(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: residentClaimKeys.all }),
  });
}

export function useRejectResidentClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (claimId: number) => rejectResidentClaim(claimId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: residentClaimKeys.all }),
  });
}
