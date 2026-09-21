import { hasModule } from "@/lib/auth/permissions";
import { extractRequestMeta, logAccess } from "@/lib/audit/accessLog";
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

export async function GET(request: Request): Promise<Response> {
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
    const pageData = await getBillPageData(context.orgId);
    const output = new URL(request.url).searchParams.get("output");
    if (output === "giro" || output === "adjustment" || output === "autoDebit") {
      const { ip, userAgent } = extractRequestMeta(request);
      await logAccess({
        event: "PRINT",
        persona: "manager_staff",
        orgId: context.orgId,
        actorId: userData.user.id,
        targetKind: "bill_output",
        detail: { output },
        ip,
        userAgent,
      });
    }
    return json(pageData);
  } catch {
    return json({ error: "서류 발행 정보를 불러오지 못했습니다." }, 500);
  }
}
