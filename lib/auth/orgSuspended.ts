// 정지(계약 만료 포함)·해지된 테넌트 접속 차단 공용 값. 클라이언트·서버 공용(서버 전용 import 없음).
// 정책(통합관리자_테넌트 관리): 정지/해지 → 그 테넌트 사무·현장 관리자와 세입자 접속 제한.

/** 로그인 화면 `?error=` 코드. 앱 게이트가 세션을 끊고 로그인 화면으로 보낼 때 쓴다. */
export const ORG_SUSPENDED_ERROR = "org_suspended";

export const ORG_SUSPENDED_MESSAGE = "정지되었거나 사용할 수 없는 조직입니다.";

export const RESIDENT_ORG_SUSPENDED_MESSAGE =
  "관리사무소 서비스가 정지되어 이용할 수 없어요. 관리사무소에 문의해 주세요.";
