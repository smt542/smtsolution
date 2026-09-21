import { useMutation, useQuery } from "@tanstack/react-query";
import { revealPii, revealPiiBatch, type PiiRevealBatchInput } from "./apis";

export function useRevealPii() {
  return useMutation({
    mutationFn: revealPii,
  });
}

export function useRevealPiiBatch(input: PiiRevealBatchInput, enabled: boolean) {
  return useQuery({
    queryKey: ["pii", "reveal", input.targetKind, input.targetId, ...input.fields],
    queryFn: () => revealPiiBatch(input),
    enabled,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });
}
