// 실행: node scripts/seed-staff.mjs (환경변수 필요: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STAFF_EMAIL_DOMAIN)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const domain = process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN || "staff.gwanribiseo.app";
const admin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

const USERNAME = "admin", PASSWORD = "erp!12345", FULL_NAME = "관리자";

const { data: org } = await admin.from("organizations")
  .insert({ name: "테스트 관리회사", slug: "demo", status: "active" }).select().single();

const { data: created, error: uerr } = await admin.auth.admin.createUser({
  email: `${USERNAME}@${domain}`, password: PASSWORD, email_confirm: true,
});
if (uerr) throw uerr;
const uid = created.user.id;

await admin.from("profiles").insert({ user_id: uid, username: USERNAME, full_name: FULL_NAME, is_active: true });
await admin.from("org_members").insert({ org_id: org.id, user_id: uid, role: "org_owner" });

console.log(`seeded: ${USERNAME}/${PASSWORD} @ org ${org.id}`);
