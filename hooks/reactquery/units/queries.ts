import { useQuery } from "@tanstack/react-query";
import { listUnits } from "./apis";
import { unitKeys } from "./keys";

export function useUnits(buildingId: number) {
  return useQuery({ queryKey: unitKeys.list(buildingId), queryFn: () => listUnits(buildingId), enabled: !!buildingId });
}
