import { useQuery } from "@tanstack/react-query";
import { listAllFeeItems, listFeeItems, type FeeItemLookupFilters } from "./apis";
import { feeItemKeys } from "./keys";

export function useFeeItems(typeId: number) {
  return useQuery({ queryKey: feeItemKeys.list(typeId), queryFn: () => listFeeItems(typeId), enabled: !!typeId });
}

export function useFeeItemLookup(filters: FeeItemLookupFilters) {
  return useQuery({
    queryKey: feeItemKeys.lookup(filters),
    queryFn: () => listAllFeeItems(filters),
  });
}
