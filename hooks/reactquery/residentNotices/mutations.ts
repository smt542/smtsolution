"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { residentMarkNoticeRead } from "./apis";
import { residentNoticeKeys } from "./keys";

export function useResidentMarkNoticeRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: residentMarkNoticeRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: residentNoticeKeys.readIds(),
      });
    },
  });
}
