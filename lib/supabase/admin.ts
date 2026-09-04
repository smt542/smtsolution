import "server-only";

import { createClient } from "@supabase/supabase-js";

// 서버 전용. service_role 키 사용 — 절대 클라이언트 번들에 포함 금지(NEXT_PUBLIC_ 아님).
export function createAdminClient() {
  // 서버 전용 가드: 최상단 `server-only` import가 클라이언트 번들에 포함되면 빌드타임에 실패시킨다.
  // 아래 런타임 가드는 방어적 백업.
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient must only be used on the server.");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
