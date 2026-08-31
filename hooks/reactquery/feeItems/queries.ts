import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  listAllFeeItems,
  listFeeItems,
  listFeeItemsForManagement,
  type FeeItemLookupFilters,
} from "./apis";
import { feeItemKeys } from "./keys";

export function useFeeItems(typeId: number) {
  return useQuery({ queryKey: feeItemKeys.list(typeId), queryFn: () => listFeeItems(typeId), enabled: !!typeId });
}

export function useAllFeeItems() {
  return useQuery({
    queryKey: feeItemKeys.management(),
    queryFn: listFeeItemsForManagement,
  });
}

export function useFeeItemLookup(filters: FeeItemLookupFilters) {
  return useQuery({
    queryKey: feeItemKeys.lookup(filters),
    queryFn: () => listAllFeeItems(filters),
    placeholderData: keepPreviousData,
  });
}
