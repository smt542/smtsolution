import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  importMigrationRows,
  resetMigrationRuns,
  type MigrationKind,
  type MigrationRowInput,
} from "./apis";
import { dataMigrationKeys } from "./keys";

export function useImportMigrationRows() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, rows }: { kind: MigrationKind; rows: MigrationRowInput[] }) =>
      importMigrationRows(kind, rows),
    // 일부만 성공했거나 요청이 중간에 실패해도 기록·대상 데이터가 바뀌었을 수 있어 항상 다시 읽는다.
    onSettled: () => qc.invalidateQueries(),
  });
}

export function useResetMigrationRuns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: resetMigrationRuns,
    onSuccess: () => qc.invalidateQueries({ queryKey: dataMigrationKeys.all }),
  });
}
