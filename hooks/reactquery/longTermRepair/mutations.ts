import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createRepair,
  updateRepair,
  deleteRepair,
  uploadRepairAttachment,
  deleteRepairAttachment,
  type LongTermRepairInput,
} from "./apis";
import { longTermRepairKeys } from "./keys";

export function useCreateRepair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: LongTermRepairInput) => createRepair(i),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: longTermRepairKeys.all }),
  });
}

export function useUpdateRepair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: Partial<LongTermRepairInput>;
    }) => updateRepair(id, input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: longTermRepairKeys.all }),
  });
}

export function useDeleteRepair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteRepair(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: longTermRepairKeys.all }),
  });
}

export function useUploadRepairAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { repairId: number; orgId: number; file: File }) =>
      uploadRepairAttachment(a),
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: longTermRepairKeys.attachments(v.repairId) }),
  });
}

export function useDeleteRepairAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { id: number; path: string; repairId: number }) =>
      deleteRepairAttachment(a),
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: longTermRepairKeys.attachments(v.repairId) }),
  });
}
