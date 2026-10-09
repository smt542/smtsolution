/** 과거 「자동 로그인 = 영구 세션」 플래그. 정책(2026-08-12/14) 「자동 로그인 = 아이디 기억」으로 더 이상 설정하지 않고, 남은 값은 제거만 한다. */
export const LEGACY_AUTO_LOGIN_KEY = "erp_login_auto";
export const SESSION_ALIVE_KEY = "erp_session_alive";  // 만료일 없는 쿠키 marker: 모든 탭이 공유하고 브라우저를 닫으면 사라진다

/** 자동 로그인(아이디 기억) 저장 키 — 직원·통합관리자 로그인은 같은 origin이라 키를 나눈다. */
export const REMEMBERED_ID_KEYS = {
  staff: "erp_login_remembered_id",
  platform: "erp_platform_login_remembered_id",
} as const;
export type RememberedIdScope = keyof typeof REMEMBERED_ID_KEYS;

export function readRememberedId(scope: RememberedIdScope): string {
  try {
    return localStorage.getItem(REMEMBERED_ID_KEYS[scope]) ?? "";
  } catch {
    return "";
  }
}

/** 로그인 성공 시 호출: 체크면 아이디 저장, 해제면 삭제. 레거시 영구 세션 플래그는 항상 제거한다. */
export function persistRememberedId(scope: RememberedIdScope, remember: boolean, username: string): void {
  try {
    if (remember && username) localStorage.setItem(REMEMBERED_ID_KEYS[scope], username);
    else localStorage.removeItem(REMEMBERED_ID_KEYS[scope]);
    localStorage.removeItem(LEGACY_AUTO_LOGIN_KEY);
  } catch {
    // 저장소 차단(사생활 보호 모드 등) 시 아이디 기억만 생략한다.
  }
}

/** 브라우저를 닫았다 다시 연 경우(세션 표식 없음) 이 브라우저의 세션을 끝낸다. */
export function shouldSignOutOnBoot(sessionAlive: boolean): boolean {
  return !sessionAlive;
}
