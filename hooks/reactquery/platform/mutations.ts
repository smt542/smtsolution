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
import {
  createPlatformAccount,
  platformResetPassword,
  platformSetActive,
  platformUpdateRole,
  type PlatformCreateAccountInput,
} from "./accounts";
import type { OrgMemberRole, StaffType } from "@/hooks/reactquery/auth";
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

export function useCreatePlatformAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PlatformCreateAccountInput) => createPlatformAccount(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.accounts() }),
  });
}

export function usePlatformUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (account: {
      orgId: number;
      userId: string;
      role: OrgMemberRole;
      staffType: StaffType;
      permissions: string[];
    }) =>
      platformUpdateRole(
        account.orgId,
        account.userId,
        account.role,
        account.staffType,
        account.permissions,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.accounts() }),
  });
}

export function usePlatformSetActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (account: { orgId: number; userId: string; active: boolean }) =>
      platformSetActive(account.orgId, account.userId, account.active),
    onSuccess: () => qc.invalidateQueries({ queryKey: platformKeys.accounts() }),
  });
}

export function usePlatformResetPassword() {
  return useMutation({
    mutationFn: (account: { userId: string; password: string }) =>
      platformResetPassword(account.userId, account.password),
  });
}
