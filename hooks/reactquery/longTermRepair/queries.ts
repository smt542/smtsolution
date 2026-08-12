import { useQuery } from "@tanstack/react-query";
import { listRepairsByBuilding, listRepairAttachments } from "./apis";
import { longTermRepairKeys } from "./keys";

export function useRepairsByBuilding(buildingId?: number) {
  return useQuery({
    queryKey: longTermRepairKeys.byBuilding(buildingId ?? 0),
    queryFn: () => listRepairsByBuilding(buildingId as number),
    enabled: !!buildingId,
  });
}

export function useRepairAttachments(repairId: number) {
  return useQuery({
    queryKey: longTermRepairKeys.attachments(repairId),
    queryFn: () => listRepairAttachments(repairId),
    enabled: !!repairId,
  });
}
