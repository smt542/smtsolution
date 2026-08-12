// hooks/reactquery/buildingCustomerNumbers/queries.ts
import { useQuery } from "@tanstack/react-query";
import { listCustomerNumbersByBuilding } from "./apis";
import { customerNumberKeys } from "./keys";
export function useCustomerNumbers(buildingId: number) {
  return useQuery({
    queryKey: customerNumberKeys.byBuilding(buildingId),
    queryFn: () => listCustomerNumbersByBuilding(buildingId),
    enabled: !!buildingId,
  });
}
