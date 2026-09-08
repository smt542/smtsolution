// lib/auth/requirePersona.ts — 서버 컴포넌트 전용(내부에서 next/headers cookies 사용).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const PREDICATE = {
  manager_staff: "current_user_is_manager_staff",
  platform_admin: "current_user_is_platform_admin",
  field_partner: "current_user_is_field_partner",
} as const;

export type WorkforcePersona = keyof typeof PREDICATE;

/** 무세션→loginPath, persona 불일치→중립 '/'(게이트 밖, 루프 방지). */
export async function requirePersona(persona: WorkforcePersona, loginPath: string): Promise<void> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect(loginPath);
  const { data: allowed } = await sb.rpc(PREDICATE[persona]);
  if (allowed !== true) redirect("/");
}

/** resident: 무세션→/resident/login, 미링크→/resident/verify. */
export async function requireResidentLink(): Promise<void> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/resident/login");
  const { data: rows } = await sb.rpc("resident_my_link");
  const link = Array.isArray(rows) ? rows[0] : rows;
  if (!link) redirect("/resident/verify");
}
