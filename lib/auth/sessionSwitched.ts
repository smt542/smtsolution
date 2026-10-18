// 같은 브라우저에서 다른 역할(세입자·현장·본사 등)로 로그인해 세션이 바뀐 경우의 로그인 화면 안내.
// 클라이언트·서버 공용(서버 전용 import 없음).

/** 로그인 화면 `?error=` 코드. EntryPersonaWatcher → switch-entry 가 세션을 끊고 붙인다. */
export const SESSION_SWITCHED_ERROR = "session_switched";

export const SESSION_SWITCHED_MESSAGE = "다른 계정으로 로그인되어 로그아웃했어요. 다시 로그인해 주세요.";
