import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveBillingCharges, confirmBilling, type SaveBillingChargesPayload } from "./apis";
import { billingKeys } from "./keys";

export function useSaveBillingCharges() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SaveBillingChargesPayload) => saveBillingCharges(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
export function useConfirmBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ buildingId, period }: { buildingId: number; period: string }) => confirmBilling(buildingId, period),
    onSuccess: () => qc.invalidateQueries({ queryKey: billingKeys.all }),
  });
}
