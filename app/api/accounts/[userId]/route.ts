import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { data: ctxRows } = await supabase.rpc("get_my_context");
  const ctx = Array.isArray(ctxRows) ? ctxRows[0] : ctxRows;
  const isMaster = ctx?.role === "org_owner" || ctx?.role === "platform_admin";
  const perms: string[] = Array.isArray(ctx?.permissions) ? ctx.permissions : [];
  if (!ctx || (!isMaster && !perms.includes("accounts")))
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  // 대상이 현재 컨텍스트의 org 구성원인지 확인한다.
  const { count: membershipCount } = await supabase
    .from("org_members")
    .select("user_id", { count: "exact", head: true })
    .eq("org_id", ctx.org_id)
    .eq("user_id", userId);
  if (!membershipCount) return NextResponse.json({ error: "대상 계정을 찾을 수 없습니다." }, { status: 404 });

  const { password } = await req.json().catch(() => ({}));
  if (typeof password !== "string" || !/^\d{4}$/.test(password))
    return NextResponse.json({ error: "비밀번호는 숫자 4자리를 입력해 주세요." }, { status: 422 });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return NextResponse.json({ error: "비밀번호 변경에 실패했습니다." }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200 });
}
