import { useQuery } from "@tanstack/react-query";
import { listLateFeeRateTiers } from "./apis";
import { lateFeeTierKeys } from "./keys";

export function useLateFeeRateTiers(orgId: number | null) {
  return useQuery({
    queryKey: lateFeeTierKeys.list(orgId ?? 0),
    queryFn: () => listLateFeeRateTiers(orgId as number),
    enabled: orgId !== null,
  });
}
