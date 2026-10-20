import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelMoveOutSchedule,
  deleteUnit,
  executeMoveOut,
  saveUnitOccupancy,
  scheduleMoveOut,
  type SaveUnitOccupancyPayload,
} from "./apis";
import { billingKeys } from "@/hooks/reactquery/billing/keys";
import { buildingKeys } from "@/hooks/reactquery/buildings/keys";
import { occupancyKeys } from "./keys";

function useInvalidateOccupancies() {
  const qc = useQueryClient();
  // 입주·퇴실·세대 삭제는 건물 목록의 세대수/입주세대수에도 영향을 준다.
  // 관리비 부과 세팅(billing)도 입주자 이름·공실 여부·건물 관리비(mgmt_fee_amount)를 함께 보여주므로 같이 무효화한다.
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: occupancyKeys.all }),
      qc.invalidateQueries({ queryKey: buildingKeys.all }),
      qc.invalidateQueries({ queryKey: billingKeys.all }),
    ]);
}

export function useSaveUnitOccupancy() {
  const invalidate = useInvalidateOccupancies();
  return useMutation({
    mutationFn: (p: SaveUnitOccupancyPayload) => saveUnitOccupancy(p),
    onSuccess: invalidate,
  });
}

export function useExecuteMoveOut() {
  const invalidate = useInvalidateOccupancies();
  return useMutation({
    mutationFn: ({ occupancyId, moveOutDate }: { occupancyId: number; moveOutDate: string }) =>
      executeMoveOut(occupancyId, moveOutDate),
    onSuccess: invalidate,
  });
}

export function useScheduleMoveOut() {
  const invalidate = useInvalidateOccupancies();
  return useMutation({
    mutationFn: ({ occupancyId, moveOutDate }: { occupancyId: number; moveOutDate: string }) =>
      scheduleMoveOut(occupancyId, moveOutDate),
    onSuccess: invalidate,
  });
}

export function useCancelMoveOutSchedule() {
  const invalidate = useInvalidateOccupancies();
  return useMutation({
    mutationFn: (occupancyId: number) => cancelMoveOutSchedule(occupancyId),
    onSuccess: invalidate,
  });
}

export function useDeleteUnit() {
  const invalidate = useInvalidateOccupancies();
  return useMutation({
    mutationFn: (unitId: number) => deleteUnit(unitId),
    onSuccess: invalidate,
  });
}
