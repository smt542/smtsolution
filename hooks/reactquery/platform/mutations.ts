import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adjustPoints,
  chargePoints,
  deletePointCharge,
  updatePointCharge,
  updateOrganizationStatus,
  createPlatformOrganization,
  updatePlatformOrganization,
  setPlatformOrganizationDeleted,
  deletePlatformOrganization,
  type AdjustPointsInput,
  type ChargePointsInput,
  type UpdatePointChargeInput,
  type OrganizationStatus,
  type CreateOrgInput,
  type UpdateOrgInput,
} from "./apis";
import {
  platformResetPassword,
  createPlatformHqAccount,
  updatePlatformHqAccount,
  deletePlatformHqAccount,
  type PlatformCreateHqAccountInput,
  type PlatformUpdateHqAccountInput,
} from "./accounts";
import { platformKeys } from "./keys";
import {
  releaseStalePointReservation,
  setMessagePointRates,
  type SetMessagePointRatesInput,
} from "./pointBilling";

export function useChargePoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChargePointsInput) => chargePoints(input),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: platformKeys.organizations() }),
      queryClient.invalidateQueries({ queryKey: [...platformKeys.all, "transactions"] }),
      queryClient.invalidateQueries({ queryKey: platformKeys.pointPoolBalance() }),
    ]),
  });
}

export function useUpdatePointCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePointChargeInput) => updatePointCharge(input),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: platformKeys.organizations() }),
      queryClient.invalidateQueries({ queryKey: [...platformKeys.all, "transactions"] }),
      queryClient.invalidateQueries({ queryKey: platformKeys.pointPoolBalance() }),
    ]),
  });
}

export function useDeletePointCharge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePointCharge(id),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: platformKeys.organizations() }),
      queryClient.invalidateQueries({ queryKey: [...platformKeys.all, "transactions"] }),
      queryClient.invalidateQueries({ queryKey: platformKeys.pointPoolBalance() }),
    ]),
  });
}

export function useUpdateOrganizationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrganizationStatus }) =>
      updateOrganizationStatus(id, status),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: platformKeys.organizations() }),
        queryClient.invalidateQueries({ queryKey: platformKeys.organizationContractKpis() }),
      ]),
  });
}

export function useAdjustPoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdjustPointsInput) => adjustPoints(input),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: platformKeys.organizations() }),
      queryClient.invalidateQueries({ queryKey: [...platformKeys.all, "transactions"] }),
      queryClient.invalidateQueries({ queryKey: platformKeys.pointPoolBalance() }),
    ]),
  });
}

export function useSetMessagePointRates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetMessagePointRatesInput) => setMessagePointRates(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: platformKeys.messagePointRates() }),
  });
}

export function useReleaseStalePointReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      releaseStalePointReservation(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...platformKeys.all, "point-reservations"],
      });
      void queryClient.invalidateQueries({ queryKey: platformKeys.organizations() });
    },
  });
}

export function useCreatePlatformOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrgInput) => createPlatformOrganization(input),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: platformKeys.organizations() }),
      qc.invalidateQueries({ queryKey: platformKeys.overview() }),
      qc.invalidateQueries({ queryKey: platformKeys.organizationContractKpis() }),
    ]),
  });
}

export function useUpdatePlatformOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateOrgInput }) =>
      updatePlatformOrganization(id, input),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: platformKeys.organizations() }),
      qc.invalidateQueries({ queryKey: platformKeys.organizationContractKpis() }),
    ]),
  });
}

export function useSetOrgDeleted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deleted }: { id: number; deleted: boolean }) =>
      setPlatformOrganizationDeleted(id, deleted),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformKeys.organizations() });
      void qc.invalidateQueries({ queryKey: platformKeys.overview() });
      void qc.invalidateQueries({ queryKey: platformKeys.organizationContractKpis() });
    },
  });
}

/** 완전 삭제는 목록·KPI·계정·포인트·청구 전부에 걸리므로 통합관리자 캐시를 통째로 무효화한다. */
export function useDeletePlatformOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePlatformOrganization(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.all }),
  });
}

export function usePlatformResetPassword() {
  return useMutation({
    mutationFn: (account: { userId: string; password: string }) =>
      platformResetPassword(account.userId, account.password),
  });
}

export function useCreatePlatformHqAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PlatformCreateHqAccountInput) => createPlatformHqAccount(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.hqAccounts() }),
  });
}

export function useUpdatePlatformHqAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PlatformUpdateHqAccountInput) => updatePlatformHqAccount(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.hqAccounts() }),
  });
}

export function useDeletePlatformHqAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deletePlatformHqAccount(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.hqAccounts() }),
  });
}
