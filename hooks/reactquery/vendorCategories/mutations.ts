import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createVendorCategory, renameVendorCategory, deleteVendorCategory, type VendorCategoryInput } from "./apis";
import { vendorCategoryKeys } from "./keys";

export function useCreateVendorCategory() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (i: VendorCategoryInput) => createVendorCategory(i), onSuccess: () => qc.invalidateQueries({ queryKey: vendorCategoryKeys.all }) });
}
export function useRenameVendorCategory() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, label }: { id: number; label: string }) => renameVendorCategory(id, label), onSuccess: () => qc.invalidateQueries({ queryKey: vendorCategoryKeys.all }) });
}
export function useDeleteVendorCategory() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => deleteVendorCategory(id), onSuccess: () => qc.invalidateQueries({ queryKey: vendorCategoryKeys.all }) });
}
