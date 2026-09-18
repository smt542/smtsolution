import { useMutation } from "@tanstack/react-query";
import { revealPii } from "./apis";

export function useRevealPii() {
  return useMutation({
    mutationFn: revealPii,
  });
}
