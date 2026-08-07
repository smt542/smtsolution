import { useQuery } from "@tanstack/react-query";
import { listBuildingTypes } from "./apis";
import { buildingTypeKeys } from "./keys";

export function useBuildingTypes() {
  return useQuery({ queryKey: buildingTypeKeys.list(), queryFn: () => listBuildingTypes() });
}
