"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { residentWithdraw } from "./apis";

export function useWithdrawResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: residentWithdraw,
    // The caller is fully unlinked; drop every cached resident query before the
    // component signs out and redirects to the login screen.
    onSuccess: () => queryClient.clear(),
  });
}
