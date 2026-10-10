import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveBillingDueSetting, type BillingDueSetting } from "./apis";
import { billingDueSettingKeys } from "./keys";

export function useSaveBillingDueSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, setting }: { orgId: number; setting: BillingDueSetting | null }) =>
      saveBillingDueSetting(orgId, setting),
    // 납부기한 기본값은 미납·연체료·세입자/파트너 기한 계산(서버)에 쓰이므로 관련 화면은 다시 불러올 때 반영된다.
    onSuccess: () => qc.invalidateQueries({ queryKey: billingDueSettingKeys.all }),
  });
}
