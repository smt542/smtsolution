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

// 사무실 관리자(staff_type=manager_staff, 본사 platform_admin 제외) 계정은 숫자 4자리 비밀번호를 강제한다
// (2026-10-13 사용자 결정). 계정 발급·관리자 재설정·최초 로그인/내 정보 변경 모두 같은 규칙.
// Auth 최소 길이는 toAuthPassword(lib/auth/password.ts)가 "pin." 접두어로 맞춘다.
export const OFFICE_PIN_LENGTH = 4;
export const OFFICE_PIN_RULE_TEXT = `숫자 ${OFFICE_PIN_LENGTH}자리`;
export const OFFICE_PIN_RULE_MESSAGE = `비밀번호는 숫자 ${OFFICE_PIN_LENGTH}자리로 입력해 주세요.`;

export function isValidOfficePin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
}

/** 사무실 관리자 계정 여부(숫자 4자리 비밀번호 대상). */
export function isOfficeManagerAccount(account: { role?: string | null; staffType?: string | null }): boolean {
  return account.staffType === "manager_staff" && account.role !== "platform_admin";
}

export type PasswordRule = "default" | "officePin";

export function passwordRuleFor(account: { role?: string | null; staffType?: string | null }): PasswordRule {
  return isOfficeManagerAccount(account) ? "officePin" : "default";
}

export function isValidPasswordFor(rule: PasswordRule, value: unknown): value is string {
  return rule === "officePin" ? isValidOfficePin(value) : isValidPassword(value);
}

export function passwordRuleMessage(rule: PasswordRule): string {
  return rule === "officePin" ? OFFICE_PIN_RULE_MESSAGE : PASSWORD_RULE_MESSAGE;
}

export function passwordRuleText(rule: PasswordRule): string {
  return rule === "officePin" ? OFFICE_PIN_RULE_TEXT : PASSWORD_RULE_TEXT;
}

export function passwordMaxLength(rule: PasswordRule): number {
  return rule === "officePin" ? OFFICE_PIN_LENGTH : PASSWORD_MAX_LENGTH;
}
