import { useQuery } from "@tanstack/react-query";
import { listMetersByUnit } from "./apis"; import { unitMeterKeys } from "./keys";
export function useUnitMeters(unitId: number) {
  return useQuery({ queryKey: unitMeterKeys.byUnit(unitId), queryFn: () => listMetersByUnit(unitId), enabled: !!unitId });
}
