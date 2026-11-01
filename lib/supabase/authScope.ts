// 화면 영역(사용자 유형)별 인증 세션 분리(QA #59).
// 같은 브라우저에서 사무실(staff)·현장(partner)·통합관리자(platform)·입주민(resident) 세션이
// 서로 덮어쓰지 않도록 영역마다 다른 Supabase 인증 쿠키 이름을 쓴다.
// 브라우저·서버·proxy 가 모두 이 모듈 하나로 경로 → 영역 → 쿠키 이름을 정한다.

export const AUTH_SCOPES = ["staff", "partner", "platform", "resident"] as const;
export type AuthScope = (typeof AUTH_SCOPES)[number];

/** 영역을 알 수 없을 때(루트 '/' 등) 쓰는 기본 영역. 기존 동작(사무실 ERP 중심)과 같다. */
export const DEFAULT_AUTH_SCOPE: AuthScope = "staff";

/**
 * 영역을 전달하는 요청 헤더. proxy 가 화면 요청에 경로 기준 값으로 덮어써 주입하고,
 * 여러 영역이 같이 쓰는 API(`/api/auth/change-password` 등)는 호출부가 직접 실어 보낸다.
 */
export const AUTH_SCOPE_HEADER = "x-auth-scope";

export function isAuthScope(value: unknown): value is AuthScope {
  return typeof value === "string" && (AUTH_SCOPES as readonly string[]).includes(value);
}

export function parseAuthScope(value: string | null | undefined): AuthScope | null {
  return isAuthScope(value) ? value : null;
}

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * 경로 → 영역. 영역이 경로로 정해지지 않으면 null.
 * - 화면: /staff·/partner·/platform-admin·/resident(·공개 공유 /share 는 입주민)
 * - API: /api/partner/*·/api/platform/*·/api/resident/* 는 해당 영역, /api/staff/* 는 사무실.
 *   여러 영역이 같이 쓰는 /api/auth/* 는 null(호출부가 영역을 명시해야 한다).
 *   그 외 /api/* 는 사무실 업무 API 라 staff.
 */
export function scopeFromPath(pathname: string): AuthScope | null {
  if (under(pathname, "/api")) {
    if (under(pathname, "/api/auth")) return null;
    if (under(pathname, "/api/partner")) return "partner";
    if (under(pathname, "/api/platform")) return "platform";
    if (under(pathname, "/api/resident")) return "resident";
    return "staff";
  }
  if (under(pathname, "/staff")) return "staff";
  if (under(pathname, "/partner")) return "partner";
  if (under(pathname, "/platform-admin")) return "platform";
  if (under(pathname, "/resident") || under(pathname, "/share")) return "resident";
  return null;
}

/** 엔트리 persona(`/api/auth/switch-entry?to=`) → 영역. */
export const PERSONA_SCOPE = {
  manager_staff: "staff",
  field_partner: "partner",
  platform_admin: "platform",
  resident: "resident",
} as const satisfies Record<string, AuthScope>;

/** supabase-js 기본 storageKey 와 같은 규칙의 프로젝트 ref(`https://<ref>.supabase.co`). */
function projectRef(supabaseUrl: string | undefined): string {
  if (!supabaseUrl) return "local";
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] || "local";
  } catch {
    return "local";
  }
}

/**
 * 영역별 인증 쿠키 이름(= supabase auth storageKey).
 * 입주민은 기존 기본 이름 `sb-<ref>-auth-token` 을 그대로 써 배포 후에도 입주민 로그인(카카오)이 유지된다.
 * 업무 영역은 `sb-<ref>-auth-token-<scope>` 로 분리한다.
 */
export function authCookieName(
  scope: AuthScope,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string {
  const base = `sb-${projectRef(supabaseUrl)}-auth-token`;
  return scope === "resident" ? base : `${base}-${scope}`;
}

/** 브라우저에서 지금 열린 화면의 영역(서버 렌더 중이면 기본 영역). */
export function currentAuthScope(): AuthScope {
  if (typeof window === "undefined") return DEFAULT_AUTH_SCOPE;
  return scopeFromPath(window.location.pathname) ?? DEFAULT_AUTH_SCOPE;
}

/** 여러 영역이 같이 쓰는 API 호출에 현재 영역을 실어 보내는 헤더. */
export function authScopeHeaders(scope: AuthScope = currentAuthScope()): Record<string, string> {
  return { [AUTH_SCOPE_HEADER]: scope };
}
