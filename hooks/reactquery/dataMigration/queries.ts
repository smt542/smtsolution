import { useQuery } from "@tanstack/react-query";
import { listMigrationRuns } from "./apis";
import { dataMigrationKeys } from "./keys";

export function useMigrationRuns() {
  return useQuery({ queryKey: dataMigrationKeys.runs(), queryFn: listMigrationRuns });
}
