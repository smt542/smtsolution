const DEFAULT_DOMAIN = "staff.gwanribiseo.app";

// 로그인 이메일 = {회사코드}.{아이디}@{도메인}  (예: demo.admin@staff.gwanribiseo.app)
// 회사코드(organizations.slug)를 섞어 org마다 같은 아이디를 재사용할 수 있게 한다.
// auth.users.email 이 전역 유일이므로, 이 조합이 곧 "org 내 아이디 유일성"을 보장한다.
export function loginEmail(companyCode: string, username: string): string {
  const c = companyCode.trim().toLowerCase();
  const u = username.trim().toLowerCase();
  if (!c) throw new Error("company code is required");
  if (!u) throw new Error("username is required");
  const domain = process.env.NEXT_PUBLIC_STAFF_EMAIL_DOMAIN || DEFAULT_DOMAIN;
  return `${c}.${u}@${domain}`;
}
