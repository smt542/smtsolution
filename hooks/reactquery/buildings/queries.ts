// hooks/reactquery/buildings/queries.ts
import { useQuery } from "@tanstack/react-query";
import {
  listBuildings,
  listAllBuildings,
  getBuildingFull,
  isBuildingCodeTaken,
  type BuildingListParams,
  type BuildingListResult,
} from "./apis";
import { buildingKeys } from "./keys";
import { listAccounts } from "@/hooks/reactquery/accounts";

export function useBuildings() {
  return useQuery({ queryKey: buildingKeys.directory(), queryFn: () => listAllBuildings() });
}

export function useBuildingList(params: BuildingListParams, initialData?: BuildingListResult) {
  return useQuery({
    queryKey: buildingKeys.list(params),
    queryFn: () => listBuildings(params),
    initialData,
  });
}
/** 숫자 3자리가 다 채워진 코드만 조회한다. 결과는 매번 새로 받는다(다른 사용자가 방금 등록했을 수 있다). */
export function useBuildingCodeTaken(code: string, excludeId?: number) {
  return useQuery({
    queryKey: buildingKeys.codeTaken(code, excludeId),
    queryFn: () => isBuildingCodeTaken(code, excludeId),
    enabled: /^\d{3}$/.test(code),
    staleTime: 0,
  });
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
