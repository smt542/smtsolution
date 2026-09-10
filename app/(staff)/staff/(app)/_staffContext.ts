import "server-only";

import type { MyContext } from "@/hooks/reactquery/auth/apis";
import { createClient } from "@/lib/supabase/server";

type MyContextDbRow = {
  org_id: number;
  role: MyContext["role"];
  org_status: MyContext["orgStatus"];
  username: string;
  full_name: string;
  is_active: boolean;
  must_change_password: boolean;
  staff_type: MyContext["staffType"];
  staff_capabilities?: unknown;
  permissions?: unknown;
};

export async function getStaffContext(): Promise<MyContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_context");

  if (error) throw new Error(error.message);

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
    staffCapabilities: Array.isArray(row.staff_capabilities) ? row.staff_capabilities : [],
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
  };
}
