import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveSetupSender,
  upsertSetupConfig,
  type SetupConfigPatch,
  type SetupSenderProduct,
} from "./apis";
import { setupConfigKeys } from "./keys";
export function useUpsertSetupConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, patch }: { orgId: number; patch: SetupConfigPatch }) => upsertSetupConfig(orgId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: setupConfigKeys.all }),
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
