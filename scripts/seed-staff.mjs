// 실행: node --env-file=.env.local scripts/seed-staff.mjs (환경변수: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_STAFF_EMAIL_DOMAIN)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
if (!svc) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
const domain = process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN || "staff.gwanribiseo.app";
const admin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

const SLUG = "demo", USERNAME = "admin", PASSWORD = "erp!12345", FULL_NAME = "관리자";

const { data: org, error: oerr } = await admin.from("organizations")
  .insert({ name: "테스트 관리회사", slug: SLUG, status: "active" }).select().single();
if (oerr) throw oerr;

const { data: created, error: uerr } = await admin.auth.admin.createUser({
  email: `${SLUG}.${USERNAME}@${domain}`, password: PASSWORD, email_confirm: true,
});
if (uerr) throw uerr;
const uid = created.user.id;

const { error: perr } = await admin.from("profiles").insert({ user_id: uid, username: USERNAME, full_name: FULL_NAME, is_active: true });
if (perr) throw perr;
const { error: merr } = await admin.from("org_members").insert({ org_id: org.id, user_id: uid, role: "org_owner" });
if (merr) throw merr;

console.log(`seeded: 회사코드=${SLUG} 아이디=${USERNAME} 비번=${PASSWORD} @ org ${org.id}`);
