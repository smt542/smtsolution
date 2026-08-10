import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertSetupConfig, type SetupConfigPatch } from "./apis";
import { setupConfigKeys } from "./keys";
export function useUpsertSetupConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, patch }: { orgId: number; patch: SetupConfigPatch }) => upsertSetupConfig(orgId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: setupConfigKeys.all }),
  });
}
