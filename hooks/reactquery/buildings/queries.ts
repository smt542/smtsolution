// hooks/reactquery/buildings/queries.ts
import { useQuery } from "@tanstack/react-query";
import { listBuildings, getBuildingFull, type BuildingListParams } from "./apis";
import { buildingKeys } from "./keys";
import { listAccounts } from "@/hooks/reactquery/accounts";

export function useBuildingList(params: BuildingListParams) {
  return useQuery({ queryKey: buildingKeys.list(params), queryFn: () => listBuildings(params) });
}
export function useBuildingFull(id: number) {
  return useQuery({ queryKey: buildingKeys.full(id), queryFn: () => getBuildingFull(id), enabled: !!id });
}
// 담당자 드롭다운: 활성 직원 계정(현장직원·세입자 제외는 UI에서 처리, 여기선 전체 계정)
export function useStaffOptions() {
  return useQuery({
    queryKey: buildingKeys.staffOptions(),
    queryFn: () => listAccounts(),
  });
}
