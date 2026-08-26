import { createClient } from "@supabase/supabase-js";

// 서버 전용. service_role 키 사용 — 절대 클라이언트 번들에 포함 금지(NEXT_PUBLIC_ 아님).
export function createAdminClient() {
  // 서버 전용 가드: 브라우저/클라이언트 번들에서 호출되면 즉시 실패시켜 service_role 오사용을 막는다.
  // (빌드타임 강제를 원하면 `server-only` 패키지 설치 후 이 파일 최상단에 import 추가.)
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient must only be used on the server.");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
