"use client";

import { useQuery } from "@tanstack/react-query";
import { getOrgContact } from "@/hooks/reactquery/org/useOrgContact";

export function useOverdueOrgContact(orgId: number) {
  return useQuery({
    queryKey: ["org", "contact", orgId] as const,
    queryFn: () => getOrgContact(orgId),
  });
}
