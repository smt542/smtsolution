import { randomBytes } from "crypto";

const PIN_PREFIX = "pin.";

// 서버 전용 임시 비밀번호(16자, URL-safe). 최초 로그인 시 must_change_password=true로 변경 유도.
export function generateTempPassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}

// Supabase Auth's minimum password length is a platform floor and cannot be lowered.
// The product specification is a four-digit numeric PIN, so transform it only when
// storing or verifying with Auth. Non-PIN passwords (including existing passwords
// and 16-character temporary passwords) pass through unchanged for compatibility.
// Every password passed to Supabase Auth for storage or verification must use this
// helper; omitting it in one path would make the affected account unable to log in.
// Known and accepted property: literally typing `pin.1234` also authenticates the
// account whose PIN is 1234, because that input is not four digits and therefore
// passes through unchanged. It grants nothing extra -- the PIN itself is still required.
export function toAuthPassword(raw: string): string {
  return /^\d{4}$/.test(raw) ? `${PIN_PREFIX}${raw}` : raw;
}
