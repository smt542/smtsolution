// Supabase Management API로 SQL을 실행한다. 마이그레이션 적용·검증용.
//
//   node --env-file=.env.local scripts/db-query.mjs <sql파일>
//
// .env.local의 SUPABASE_ACCESS_TOKEN(PAT)과 NEXT_PUBLIC_SUPABASE_URL을 쓴다.
// URL에서 뽑은 project ref가 아래 EXPECTED_REF와 다르면 즉시 중단한다 —
// 다른 라이브 프로젝트에 DDL을 쏘는 사고를 막기 위한 가드다.
//
// 주의: Node의 global fetch는 통과하지만 Python urllib 기본 UA는 Cloudflare가
// 403(error 1010)으로 막는다. User-Agent를 명시하는 이유다.
import fs from "node:fs";

const EXPECTED_REF = "amhtprmapxlizdnsgbeg";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = url.replace(/^https:\/\//, "").split(".")[0];
if (ref !== EXPECTED_REF) {
  console.error(`REF GUARD FAILED: expected ${EXPECTED_REF}, got "${ref}"`);
  process.exit(1);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN missing (.env.local)");
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("usage: node --env-file=.env.local scripts/db-query.mjs <sqlfile>");
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "curl/8",
  },
  body: JSON.stringify({ query: fs.readFileSync(file, "utf8") }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}\n${text}`);
  process.exit(1);
}
console.log(text);
