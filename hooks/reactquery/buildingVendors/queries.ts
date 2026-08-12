// hooks/reactquery/buildingVendors/queries.ts
import { useQuery } from "@tanstack/react-query";
import { listBuildingVendorsByBuilding } from "./apis";
import { buildingVendorKeys } from "./keys";
export function useBuildingVendors(buildingId: number) {
  return useQuery({
    queryKey: buildingVendorKeys.byBuilding(buildingId),
    queryFn: () => listBuildingVendorsByBuilding(buildingId),
    enabled: !!buildingId,
  });
}
