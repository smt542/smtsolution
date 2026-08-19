"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  residentCancelMoveOut,
  residentCreateMoveOut,
  residentUpdateMoveOut,
  type CreateMoveOutInput,
} from "./apis";
import { residentMoveOutKeys } from "./keys";

export function useCreateMoveOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ desiredDate, reason }: CreateMoveOutInput) =>
      residentCreateMoveOut(desiredDate, reason),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: residentMoveOutKeys.all }),
  });
}

export function useUpdateMoveOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (desiredDate: string) => residentUpdateMoveOut(desiredDate),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: residentMoveOutKeys.all }),
  });
}

export function useCancelMoveOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: residentCancelMoveOut,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: residentMoveOutKeys.all }),
  });
}
