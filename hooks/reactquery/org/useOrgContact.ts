"use client";

import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/hooks/reactquery/auth";
import { createClient } from "@/lib/supabase/client";

export interface OrgContact {
  phone: string | null;
}

export async function getOrgContact(orgId: number): Promise<OrgContact> {
  const { data, error } = await createClient()
    .from("organizations")
    .select("phone")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { phone: data?.phone ?? null };
}

/** 현재 로그인 사용자의 조직 관리사무소 연락처를 조회한다. */
export function useOrgContact() {
  const { data: me } = useMe();
  const orgId = me?.orgId ?? null;

  return useQuery({
    queryKey: ["org", "contact", orgId ?? 0] as const,
    queryFn: () => getOrgContact(orgId as number),
    enabled: orgId !== null,
  });
}
