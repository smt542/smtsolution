import { useQuery } from "@tanstack/react-query";
import { listVendors } from "./apis";
import { vendorKeys } from "./keys";

export function useVendors(categoryId?: number, search?: string) {
  return useQuery({ queryKey: vendorKeys.list(categoryId, search), queryFn: () => listVendors(categoryId, search) });
}
