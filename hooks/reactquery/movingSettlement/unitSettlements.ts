import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface UnitSettlementRow {
  id: number;
  moveOutDate: string | null;
  createdAt: string;
  status: string;
}

export async function listUnitSettlements(
  unitId: number,
): Promise<UnitSettlementRow[]> {
  const { data, error } = await createClient()
    .from("moving_settlements")
    .select("id, move_out_date, created_at, status")
    .eq("unit_id", unitId)
    .order("move_out_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    moveOutDate: row.move_out_date,
    createdAt: row.created_at,
    status: row.status,
  }));
}

export function useUnitSettlements(unitId: number | null) {
  return useQuery({
    queryKey: ["movingSettlement", "unitSettlements", unitId],
    queryFn: () => listUnitSettlements(unitId as number),
    enabled: unitId !== null,
  });
}
