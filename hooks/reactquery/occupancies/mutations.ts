import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelMoveOutSchedule,
  executeMoveOut,
  saveUnitOccupancy,
  scheduleMoveOut,
  type SaveUnitOccupancyPayload,
} from "./apis";
import { occupancyKeys } from "./keys";

function useInvalidateOccupancies() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: occupancyKeys.all });
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
