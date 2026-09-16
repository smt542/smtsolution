import { hasModule } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getBillPageData } from "@/app/(staff)/staff/(app)/bill/data";
import type { MyContext } from "@/hooks/reactquery/auth/apis";

type ContextRow = {
  org_id?: number;
  role?: MyContext["role"];
  permissions?: unknown;
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return json({ error: "로그인이 필요합니다." }, 401);

  const { data: contextData, error: contextError } = await supabase.rpc("get_my_context");
  if (contextError) return json({ error: "서류 발행 정보를 불러오지 못했습니다." }, 500);

  const row = (Array.isArray(contextData) ? contextData[0] : contextData) as ContextRow | null;
  const context = row?.org_id && row.role
    ? ({
        orgId: row.org_id,
        role: row.role,
        permissions: Array.isArray(row.permissions) ? row.permissions : [],
      } as MyContext)
    : null;
  if (!context || !hasModule(context, "bill_publish")) {
    return json({ error: "권한이 없습니다." }, 403);
  }

  const { data: isManagerStaff, error: personaError } = await supabase.rpc("current_user_is_manager_staff");
  if (personaError || isManagerStaff !== true) {
    return json({ error: "권한이 없습니다." }, 403);
  }

  try {
    return json(await getBillPageData(context.orgId));
  } catch {
    return json({ error: "서류 발행 정보를 불러오지 못했습니다." }, 500);
  }
}
