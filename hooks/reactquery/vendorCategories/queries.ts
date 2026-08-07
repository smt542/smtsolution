import { useQuery } from "@tanstack/react-query";
import { listVendorCategories } from "./apis";
import { vendorCategoryKeys } from "./keys";

export function useVendorCategories() {
  return useQuery({ queryKey: vendorCategoryKeys.list(), queryFn: listVendorCategories });
}
