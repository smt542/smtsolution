import { useQuery } from "@tanstack/react-query";
import { listVendors, listVendorAttachments } from "./apis";
import { vendorKeys } from "./keys";

export function useVendors(categoryId?: number, search?: string) {
  return useQuery({ queryKey: vendorKeys.list(categoryId, search), queryFn: () => listVendors(categoryId, search) });
}

export function useVendorAttachments(vendorId: number) {
  return useQuery({ queryKey: vendorKeys.attachments(vendorId), queryFn: () => listVendorAttachments(vendorId), enabled: !!vendorId });
}
