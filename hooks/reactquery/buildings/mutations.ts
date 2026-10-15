// hooks/reactquery/buildings/mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveBuilding, deleteBuilding, setBuildingSetupConfirm, type SaveBuildingPayload } from "./apis";
import { buildingKeys } from "./keys";
import { customerNumberKeys } from "../buildingCustomerNumbers/keys";
import { utilityKeys } from "../utilities/keys";

export function useSaveBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SaveBuildingPayload) => saveBuilding(p),
    // 부가정보 고객번호가 바뀌면 전기/수도/가스 고객번호 요약에도 바로 반영되도록 함께 무효화한다.
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: buildingKeys.all }),
      qc.invalidateQueries({ queryKey: customerNumberKeys.all }),
      qc.invalidateQueries({ queryKey: utilityKeys.all }),
    ]),
  });
}
export function useSetBuildingSetupConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, required }: { id: number; required: boolean }) => setBuildingSetupConfirm(id, required),
    onSuccess: () => qc.invalidateQueries({ queryKey: buildingKeys.all }),
  });
}
export function useDeleteBuilding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteBuilding(id),
    onSuccess: (_data, id) => {
      // 목록 캐시를 비워 목록 화면이 서버가 새로 준 첫 페이지로 바로 그리게 한다(지운 건물이 잠깐 남지 않게).
      qc.removeQueries({ queryKey: buildingKeys.lists() });
      // 지운 건물 상세는 다시 부르지 않는다 — 삭제된 행이라 조회가 실패하고 재시도만큼 화면 이동이 늦어진다.
      return qc.invalidateQueries({
        queryKey: buildingKeys.all,
        predicate: ({ queryKey }) => !(queryKey[1] === "full" && queryKey[2] === id),
      });
    },
  });
}
