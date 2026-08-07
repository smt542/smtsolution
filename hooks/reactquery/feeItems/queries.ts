import { useQuery } from "@tanstack/react-query";
import { listFeeItems } from "./apis";
import { feeItemKeys } from "./keys";

export function useFeeItems(typeId: number) {
  return useQuery({ queryKey: feeItemKeys.list(typeId), queryFn: () => listFeeItems(typeId), enabled: !!typeId });
}
