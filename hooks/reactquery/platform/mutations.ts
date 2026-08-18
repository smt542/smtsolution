import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  chargePoints,
  updateOrganizationStatus,
  createPlatformOrganization,
  updatePlatformOrganization,
  setPlatformOrganizationDeleted,
  type ChargePointsInput,
  type OrganizationStatus,
  type CreateOrgInput,
  type UpdateOrgInput,
} from "./apis";
import { platformKeys } from "./keys";

export function useChargePoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChargePointsInput) => chargePoints(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: platformKeys.organizations() });
      void queryClient.invalidateQueries({ queryKey: [...platformKeys.all, "transactions"] });
    },
  });
}

export function useUpdateOrganizationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrganizationStatus }) =>
      updateOrganizationStatus(id, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: platformKeys.organizations() }),
  });
}

export function useCreatePlatformOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrgInput) => createPlatformOrganization(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: platformKeys.organizations() });
      void qc.invalidateQueries({ queryKey: platformKeys.overview() });
    },
  });
}

export function useUpdatePlatformOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateOrgInput }) =>
      updatePlatformOrganization(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.organizations() }),
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
    },
  });
}
