export const AUTO_LOGIN_KEY = "erp_login_auto";        // localStorage: '1' | (username 프리필과 별도 플래그)
export const SESSION_ALIVE_KEY = "erp_session_alive";  // 만료일 없는 쿠키 marker: 모든 탭이 공유하고 브라우저를 닫으면 사라진다

export function shouldSignOutOnBoot(autoLoginPref: boolean, sessionAlive: boolean): boolean {
  return !autoLoginPref && !sessionAlive;
}
