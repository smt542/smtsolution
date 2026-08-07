export const AUTO_LOGIN_KEY = "erp_login_auto";        // localStorage: '1' | (username 프리필과 별도 플래그)
export const SESSION_ALIVE_KEY = "erp_session_alive";  // sessionStorage marker

export function shouldSignOutOnBoot(autoLoginPref: boolean, sessionAlive: boolean): boolean {
  return !autoLoginPref && !sessionAlive;
}
