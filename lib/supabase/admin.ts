import { createClient } from "@supabase/supabase-js";

// 서버 전용. service_role 키 사용 — 절대 클라이언트 번들에 포함 금지(NEXT_PUBLIC_ 아님).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
