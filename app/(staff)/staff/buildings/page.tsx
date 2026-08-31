import { redirect } from "next/navigation";

import type { MyContext } from "@/hooks/reactquery/auth";
import type { BuildingDirectoryRow, BuildingListResult } from "@/hooks/reactquery/buildings";
import { hasModule } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { BuildingTenantManager } from "./components/BuildingTenantManager";

export const dynamic = "force-dynamic";

type MyContextDbRow = {
  org_id: number;
  role: MyContext["role"];
  org_status: MyContext["orgStatus"];
  username: string;
  full_name: string;
  is_active: boolean;
  must_change_password: boolean;
  staff_type: MyContext["staffType"];
  permissions: unknown;
};

type BuildingDirectoryDbRow = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  manager_user_id: string | null;
  meter_user_id: string | null;
  cleaning_user_id: string | null;
  manager_name: string | null;
  meter_name: string | null;
  cleaning_name: string | null;
  total_units: unknown;
  occupied_units: unknown;
  min_meter_day: number | null;
  total: unknown;
  type_label?: string | null;
  owner_name?: string | null;
  owner_phone?: string | null;
  entrance_password?: string | null;
  created_at?: string | null;
};

function toMyContext(data: unknown): MyContext | null {
  const row = (Array.isArray(data) ? data[0] : data) as MyContextDbRow | null;
  if (!row) return null;

  return {
    orgId: row.org_id,
    role: row.role,
    orgStatus: row.org_status,
    username: row.username,
    fullName: row.full_name,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    staffType: row.staff_type,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
  };
}

function toBuildingDirectory(row: BuildingDirectoryDbRow): BuildingDirectoryRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    address: row.address,
    managerUserId: row.manager_user_id,
    meterUserId: row.meter_user_id,
    cleaningUserId: row.cleaning_user_id,
    managerName: row.manager_name,
    meterName: row.meter_name,
    cleaningName: row.cleaning_name,
    totalUnits: Number(row.total_units ?? 0),
    occupiedUnits: Number(row.occupied_units ?? 0),
    minMeterDay: row.min_meter_day,
    typeLabel: row.type_label ?? null,
    ownerName: row.owner_name ?? null,
    ownerPhone: row.owner_phone ?? null,
    commonEntrance: row.entrance_password ?? null,
    createdAt: row.created_at ?? null,
  };
}

export default async function BuildingsPage() {
  const supabase = await createClient();
  const [userResult, contextResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("get_my_context"),
  ]);

  if (!userResult.data.user) redirect("/staff/login");
  if (contextResult.error) throw new Error(contextResult.error.message);

  const me = toMyContext(contextResult.data);
  if (!hasModule(me, "buildings")) {
    return (
      <div className="p-6">
        <p className="text-sm text-t3">이 화면에 접근할 권한이 없습니다. (건물 관리 권한 필요)</p>
      </div>
    );
  }

  const { data, error } = await supabase.rpc("list_buildings", {
    p_search: null,
    p_manager: null,
    p_meter: null,
    p_cleaning: null,
    p_limit: 20,
    p_offset: 0,
  });
  if (error) throw new Error(error.message);

  const dbRows = (data ?? []) as BuildingDirectoryDbRow[];
  const initialData: BuildingListResult = {
    rows: dbRows.map(toBuildingDirectory),
    total: dbRows.length > 0 ? Number(dbRows[0].total) : 0,
  };

  return <BuildingTenantManager initialData={initialData} />;
}
