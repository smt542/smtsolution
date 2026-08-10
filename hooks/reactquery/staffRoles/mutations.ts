import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createStaffRole, renameStaffRole, deleteStaffRole, type StaffRoleInput } from "./apis";
import { staffRoleKeys } from "./keys";
export function useCreateStaffRole() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (i: StaffRoleInput) => createStaffRole(i),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffRoleKeys.all }) });
}
export function useRenameStaffRole() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, label }: { id: number; label: string }) => renameStaffRole(id, label),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffRoleKeys.all }) });
}
export function useDeleteStaffRole() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => deleteStaffRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffRoleKeys.all }) });
}
