import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  replaceLateFeeRateTiers,
  type LateFeeRateTierInput,
} from "./apis";
import { lateFeeTierKeys } from "./keys";

export function useReplaceLateFeeRateTiers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orgId,
      tiers,
    }: {
      orgId: number;
      tiers: LateFeeRateTierInput[];
    }) => replaceLateFeeRateTiers(orgId, tiers),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: lateFeeTierKeys.all }),
  });
}
