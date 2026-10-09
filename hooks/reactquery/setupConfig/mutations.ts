import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveSetupSender,
  upsertSetupConfig,
  type SetupConfigPatch,
  type SetupSenderProduct,
} from "./apis";
import { billKeys } from "@/hooks/reactquery/bill/keys";
import { setupConfigKeys } from "./keys";
export function useUpsertSetupConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, patch }: { orgId: number; patch: SetupConfigPatch }) => upsertSetupConfig(orgId, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: setupConfigKeys.all });
      // 서류 발행 모달은 고지서 설정(계좌·안내문·출력옵션)을 page-data 로 읽는다.
      void qc.invalidateQueries({ queryKey: billKeys.pageDataAll });
    },
  });
}

export function useSaveSetupSender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ product, number }: { product: SetupSenderProduct; number: string }) =>
      saveSetupSender(product, number),
    onSuccess: () => qc.invalidateQueries({ queryKey: setupConfigKeys.all }),
  });
}
