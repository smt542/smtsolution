import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 저장소 remove는 한 번에 넘기는 경로 수를 나눠 보낸다.
const STORAGE_REMOVE_BATCH = 100;

interface PurgeResult {
  user_ids?: string[] | null;
  contract_objects?: string[] | null;
  attachment_objects?: string[] | null;
}

/**
 * 테넌트 완전 삭제(정본 상세 모달 [삭제]) — 되돌릴 수 없다.
 * 1) DB: platform_purge_organization(마이그 0204)이 조직과 딸린 데이터를 한 트랜잭션으로 지우고,
 *    지울 로그인 계정·저장소 파일 목록을 돌려준다(통합관리자 계정이 속한 조직은 거절).
 * 2) 그 목록으로 로그인 계정(프로필은 CASCADE)과 파일을 service role로 정리한다. DB 삭제는 이미 끝났으므로
 *    여기서 실패한 것은 결과에 세어 알리고 로그만 남긴다.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const orgId = Number(id);
  if (!Number.isSafeInteger(orgId) || orgId <= 0) {
    return NextResponse.json({ error: "잘못된 테넌트입니다." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { data: isPa } = await supabase.rpc("current_user_is_platform_admin");
  if (!isPa) {
    return NextResponse.json({ error: "통합관리자 권한이 필요합니다." }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("platform_purge_organization", { p_org_id: orgId });
  if (error) {
    if (error.hint === "PLATFORM_ADMIN_MEMBER") {
      return NextResponse.json(
        { error: "통합관리자 계정이 속한 테넌트는 삭제할 수 없어요." },
        { status: 409 },
      );
    }
    if (error.code === "P0002") {
      return NextResponse.json({ error: "테넌트를 찾을 수 없습니다." }, { status: 404 });
    }
    console.error("[platform organizations] purge failed", error.message);
    return NextResponse.json({ error: "테넌트 삭제에 실패했습니다." }, { status: 500 });
  }

  const result = (data ?? {}) as PurgeResult;
  const admin = createAdminClient();

  let deletedAccounts = 0;
  let failedAccounts = 0;
  for (const userId of result.user_ids ?? []) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      failedAccounts += 1;
      console.error("[platform organizations] auth user delete failed", userId, deleteError.message);
    } else {
      deletedAccounts += 1;
    }
  }

  const removeObjects = async (bucket: string, paths: string[] | null | undefined) => {
    const list = paths ?? [];
    for (let index = 0; index < list.length; index += STORAGE_REMOVE_BATCH) {
      const { error: removeError } = await admin.storage
        .from(bucket)
        .remove(list.slice(index, index + STORAGE_REMOVE_BATCH));
      if (removeError) {
        console.error("[platform organizations] storage cleanup failed", bucket, removeError.message);
      }
    }
  };
  await removeObjects("org-contracts", result.contract_objects);
  await removeObjects("attachments", result.attachment_objects);

  return NextResponse.json({ deletedAccounts, failedAccounts }, { status: 200 });
}
