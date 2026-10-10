// 계정 비밀번호 규칙(클라이언트·서버 공용). 형식 제한 없이 최소 길이만 본다(2026-10-10 사용자 결정).
// 상한 72자는 Auth(bcrypt)가 72바이트 이후를 무시하므로 둔다. 앞뒤 공백도 비밀번호의 일부로 취급한다(trim 금지).
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 72;

export const PASSWORD_RULE_TEXT = `${PASSWORD_MIN_LENGTH}자 이상`;
export const PASSWORD_RULE_MESSAGE = `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.`;

export function isValidPassword(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= PASSWORD_MIN_LENGTH
    && value.length <= PASSWORD_MAX_LENGTH;
}
