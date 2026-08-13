import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  chargePoints,
  updateOrganizationStatus,
  type ChargePointsInput,
  type OrganizationStatus,
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
