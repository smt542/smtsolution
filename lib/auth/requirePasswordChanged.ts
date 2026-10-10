// 서버 전용(next/headers). 관리자가 발급·재설정한 임시 비밀번호(must_change_password=true)로 들어온 세션은
// 비밀번호를 바꾸기 전까지 서비스 화면에 들어가지 못하게 변경 화면으로 보낸다.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requirePasswordChanged(changePath: string): Promise<void> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return; // 무세션은 requirePersona 가 처리한다.
  const { data } = await sb
    .from("profiles")
    .select("must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();
  if (data?.must_change_password) redirect(changePath);
}

/** 변경 화면용: 변경할 필요가 없으면(이미 변경함) 홈으로 돌려보낸다. 무세션은 로그인으로. */
export async function requirePendingPasswordChange(loginPath: string, homePath: string): Promise<void> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect(loginPath);
  const { data } = await sb
    .from("profiles")
    .select("must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data?.must_change_password) redirect(homePath);
}
