"use client";

import { useQuery } from "@tanstack/react-query";

import { residentGetProfile } from "./apis";
import { residentProfileKeys } from "./keys";

export function useResidentProfile() {
  return useQuery({
    queryKey: residentProfileKeys.profile(),
    queryFn: residentGetProfile,
  });
}
