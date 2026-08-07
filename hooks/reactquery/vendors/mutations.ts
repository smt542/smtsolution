import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createVendor, updateVendor, deleteVendor, uploadVendorAttachment, deleteVendorAttachment, type VendorInput } from "./apis";
import { vendorKeys } from "./keys";

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (i: VendorInput) => createVendor(i), onSuccess: () => qc.invalidateQueries({ queryKey: vendorKeys.all }) });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: number; input: Partial<VendorInput> }) => updateVendor(id, input), onSuccess: () => qc.invalidateQueries({ queryKey: vendorKeys.all }) });
}

export function useDeleteVendor() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => deleteVendor(id), onSuccess: () => qc.invalidateQueries({ queryKey: vendorKeys.all }) });
}

export function useUploadVendorAttachment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (args: { vendorId: number; orgId: number; file: File }) => uploadVendorAttachment(args), onSuccess: () => qc.invalidateQueries({ queryKey: vendorKeys.all }) });
}

export function useDeleteVendorAttachment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (args: { id: number; path: string }) => deleteVendorAttachment(args), onSuccess: () => qc.invalidateQueries({ queryKey: vendorKeys.all }) });
}
