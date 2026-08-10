import { useQuery } from "@tanstack/react-query";
import { getSetupConfig } from "./apis";
import { setupConfigKeys } from "./keys";
export function useSetupConfig() {
  return useQuery({ queryKey: setupConfigKeys.detail(), queryFn: getSetupConfig });
}
