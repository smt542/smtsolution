import { randomBytes } from "crypto";

// 서버 전용 임시 비밀번호(16자, URL-safe). 최초 로그인 시 must_change_password=true로 변경 유도.
export function generateTempPassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}
