"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface OrganizationPrintInfo {
  name: string | null;
  phone: string | null;
  fax: string | null;
  representativeName: string | null;
  address: string | null;
}

interface OrganizationPrintInfoRow {
  name: string | null;
  phone: string | null;
  fax: string | null;
  representative_name: string | null;
  address: string | null;
}

export async function getOrganizationPrintInfo(
  orgId: number,
): Promise<OrganizationPrintInfo | null> {
  const { data, error } = await createClient()
    .from("organizations")
    .select("name, phone, fax, representative_name, address")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const row = data as OrganizationPrintInfoRow | null;
  return row
    ? {
        name: row.name ?? null,
        phone: row.phone ?? null,
        fax: row.fax ?? null,
        representativeName: row.representative_name ?? null,
        address: row.address ?? null,
      }
    : null;
}

export function useOrganizationPrintInfo(
  orgId: number | null | undefined,
) {
  return useQuery({
    queryKey: ["org", "printInfo", orgId ?? 0] as const,
    queryFn: () => getOrganizationPrintInfo(orgId as number),
    enabled: !!orgId,
  });
}
