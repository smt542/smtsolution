import { useQuery } from "@tanstack/react-query";
import { getSetupConfig } from "./apis";
import { setupConfigKeys } from "./keys";
export function useSetupConfig(orgId?: number) {
  return useQuery({ queryKey: setupConfigKeys.detail(orgId), queryFn: () => getSetupConfig(orgId as number), enabled: !!orgId });
}
