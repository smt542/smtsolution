import { useQuery } from "@tanstack/react-query";
import { listAccountsByUnit } from "./apis"; import { unitAccountKeys } from "./keys";
export function useUnitAccounts(unitId: number) {
  return useQuery({ queryKey: unitAccountKeys.byUnit(unitId), queryFn: () => listAccountsByUnit(unitId), enabled: !!unitId });
}
