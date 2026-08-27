// hooks/reactquery/buildingCustomerNumbers/queries.ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  listCustomerNumbers,
  listCustomerNumbersByBuilding,
  type CustomerNumberFilters,
} from "./apis";
import { customerNumberKeys } from "./keys";
export function useCustomerNumbers(buildingId: number) {
  return useQuery({
    queryKey: customerNumberKeys.byBuilding(buildingId),
    queryFn: () => listCustomerNumbersByBuilding(buildingId),
    enabled: !!buildingId,
  });
}

export function useCustomerNumberLookup(filters: CustomerNumberFilters) {
  return useQuery({
    queryKey: customerNumberKeys.lookup(filters),
    queryFn: () => listCustomerNumbers(filters),
    placeholderData: keepPreviousData,
  });
}
