import { useQuery } from "@tanstack/react-query";
import { getBillingDueSetting } from "./apis";
import { billingDueSettingKeys } from "./keys";

export function useBillingDueSetting(orgId?: number | null) {
  return useQuery({
    queryKey: billingDueSettingKeys.detail(orgId),
    queryFn: () => getBillingDueSetting(orgId as number),
    enabled: !!orgId,
  });
}
