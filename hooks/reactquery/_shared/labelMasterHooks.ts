import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LabelMasterInput, LabelMasterRow } from "./labelMaster";

export interface LabelMasterApi {
  list: () => Promise<LabelMasterRow[]>;
  create: (i: LabelMasterInput) => Promise<LabelMasterRow>;
  rename: (id: number, label: string) => Promise<LabelMasterRow>;
  softDelete: (id: number) => Promise<void>;
}

export function makeLabelMasterHooks(base: string, api: LabelMasterApi) {
  const keys = { all: [base] as const, list: () => [base, "list"] as const };
  return {
    keys,
    useList: () => useQuery({ queryKey: keys.list(), queryFn: api.list }),
    useCreate: () => {
      const qc = useQueryClient();
      return useMutation({ mutationFn: (i: LabelMasterInput) => api.create(i), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
    },
    useRename: () => {
      const qc = useQueryClient();
      return useMutation({ mutationFn: ({ id, label }: { id: number; label: string }) => api.rename(id, label), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
    },
    useRemove: () => {
      const qc = useQueryClient();
      return useMutation({ mutationFn: (id: number) => api.softDelete(id), onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }) });
    },
  };
}
