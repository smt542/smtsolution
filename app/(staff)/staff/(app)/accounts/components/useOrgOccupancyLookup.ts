"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { compareBuildingCode } from "@/lib/buildings/sort";

export interface OrgOccupancyOption {
  occupancyId: number;
  buildingId: number;
  buildingName: string;
  buildingCode: string;
  unitId: number;
  unitNo: string;
  tenantName: string | null;
  phone: string | null;
}

type Relation<T> = T | T[] | null;

type OccupancyLookupRow = {
  id: number;
  tenant_name: string | null;
  phone: string | null;
  units: Relation<{
    id: number;
    unit_no: string;
    buildings: Relation<{
      id: number;
      code: string;
      name: string;
    }>;
  }>;
};

function one<T>(relation: Relation<T>): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

export async function listOrgOccupancyOptions(): Promise<OrgOccupancyOption[]> {
  const { data, error } = await createClient()
    .from("occupancies")
    .select(`
      id,
      tenant_name,
      phone,
      units!inner (
        id,
        unit_no,
        buildings!inner (
          id,
          code,
          name
        )
      )
    `)
    .eq("status", "occupied")
    .is("deleted_at", null)
    .is("units.deleted_at", null)
    .is("units.buildings.deleted_at", null);

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as OccupancyLookupRow[])
    .flatMap((row) => {
      const unit = one(row.units);
      const building = unit ? one(unit.buildings) : null;
      if (!unit || !building) return [];

      return [{
        occupancyId: row.id,
        buildingId: building.id,
        buildingName: building.name,
        buildingCode: building.code,
        unitId: unit.id,
        unitNo: unit.unit_no,
        tenantName: row.tenant_name,
        phone: row.phone,
      }];
    })
    .sort((a, b) => (
      compareBuildingCode(
        { code: a.buildingCode, id: a.buildingId },
        { code: b.buildingCode, id: b.buildingId },
      )
      || a.unitNo.localeCompare(b.unitNo, "ko", { numeric: true })
    ));
}

export function useOrgOccupancyLookup(enabled: boolean) {
  return useQuery({
    queryKey: ["staff", "resident-claim-occupancies"],
    queryFn: listOrgOccupancyOptions,
    enabled,
  });
}
