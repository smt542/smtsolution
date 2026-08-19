"use client";

import { useQuery } from "@tanstack/react-query";

import { residentGetMoveOut } from "./apis";
import { residentMoveOutKeys } from "./keys";

export function useMoveOutRequest() {
  return useQuery({
    queryKey: residentMoveOutKeys.request(),
    queryFn: residentGetMoveOut,
  });
}
