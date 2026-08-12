import { useQuery } from "@tanstack/react-query";
import { getLeaseByOccupancy } from "./apis"; import { leaseKeys } from "./keys";
export function useLease(occupancyId: number) {
  return useQuery({ queryKey: leaseKeys.byOccupancy(occupancyId), queryFn: () => getLeaseByOccupancy(occupancyId), enabled: !!occupancyId });
}
