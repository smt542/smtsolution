import { createClient } from "@/lib/supabase/client";

// 프로필 비밀번호 보기: 파트너 로그인에 성공할 때 암호화해 둔 본인 비밀번호(0212).
// 이 기능 전에 로그인한 세션이거나 비밀번호가 바뀐 뒤 아직 다시 로그인하지 않았으면 null.
export async function getPartnerMyPin(): Promise<string | null> {
  const { data, error } = await createClient().rpc("partner_get_my_pin");
  if (error) throw new Error(error.message);
  return typeof data === "string" ? data : null;
}
