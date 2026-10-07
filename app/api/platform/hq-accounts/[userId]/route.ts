import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  // 계정 추가·수정·삭제는 마스터·운영만(지원·영업은 조회 전용).
  const { data: canManage } = await supabase.rpc("current_user_can_manage_hq_accounts");
  if (!canManage) {
    return NextResponse.json({ error: "본사 계정 관리 권한이 필요합니다." }, { status: 403 });
  }

  const { error: prepareError } = await supabase.rpc("platform_prepare_hq_account_delete", {
    p_user_id: userId,
  });
  if (prepareError) {
    if (prepareError.hint === "SELF") {
      return NextResponse.json({ error: "본인 계정은 삭제할 수 없어요." }, { status: 409 });
    }
    if (prepareError.hint === "LAST_ADMIN") {
      return NextResponse.json({ error: "마지막 본사 계정은 삭제할 수 없어요." }, { status: 409 });
    }
    if (prepareError.hint === "OTHER_ROLE") {
      return NextResponse.json(
        { error: "다른 조직에도 소속된 계정은 여기서 삭제할 수 없어요." },
        { status: 409 },
      );
    }
    if (prepareError.code === "P0002") {
      return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
    }
    console.error("[platform/hq-accounts] delete guard failed", prepareError.message);
    return NextResponse.json({ error: "계정 삭제에 실패했습니다." }, { status: 500 });
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("[platform/hq-accounts] auth user delete failed", userId, deleteError.message);
    return NextResponse.json({ error: "계정 삭제에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
