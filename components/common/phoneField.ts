import { formatPhone } from "@/lib/format";

/**
 * 전화번호 입력의 공통 동작.
 *
 * 화면마다 입력 래퍼가 다르다(`PhoneInput`, 건물 등록의 `TextField`, 입주자폼의 `TextField`).
 * 래퍼는 저마다 스타일·props 계약이 달라 하나로 합칠 수 없지만, "숫자만 남기고 하이픈을 붙이고
 * 커서를 보존한다"는 동작은 같다. 그 동작만 여기 모아 세 래퍼가 공유한다.
 */

/**
 * 국제표기로 붙여넣은 값을 국내표기로 바꾼다. `+`가 있을 때만 건드리므로
 * 타이핑 중에 `82`를 쳤다고 갑자기 `0`으로 변하는 일은 없다.
 */
function stripCountryCode(raw: string): string {
  return raw.trimStart().startsWith("+82") ? `0${raw.replace(/^\s*\+82/, "")}` : raw;
}

/** 포맷된 문자열에서 앞에서 n번째 숫자 바로 뒤의 인덱스. */
function caretAfterDigits(formatted: string, n: number): number {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (formatted[i] >= "0" && formatted[i] <= "9") {
      seen += 1;
      if (seen === n) return i + 1;
    }
  }
  return formatted.length;
}

/**
 * 입력 요소의 값을 전화번호 형식으로 맞추고 커서를 보존한다. 포맷된 값을 돌려준다.
 *
 * 값을 DOM에 직접 써 넣는 이유는 두 가지다.
 * - controlled 래퍼: 핸들러가 `event.target.value`에서 포맷된 값을 그대로 읽는다
 * - uncontrolled 래퍼(react-hook-form `register`): 폼이 기록하는 값이 포맷된 값이 된다
 *
 * 포맷 때문에 길이가 바뀌면 브라우저가 커서를 끝으로 보내므로, "커서 앞 숫자 개수"를
 * 기준으로 되돌려 놓는다. 중간을 고칠 때 커서가 튀지 않게 하려는 것이다.
 */
export function applyPhoneFormat(element: HTMLInputElement): string {
  const raw = stripCountryCode(element.value);
  const selection = element.selectionStart ?? raw.length;
  const digitsBeforeCaret = raw.slice(0, selection).replace(/\D/g, "").length;
  const next = formatPhone(raw);

  element.value = next;
  const caret = caretAfterDigits(next, digitsBeforeCaret);
  element.setSelectionRange(caret, caret);
  return next;
}

/** 전화번호 입력에 공통으로 붙는 HTML 속성. */
export const PHONE_INPUT_ATTRS = {
  type: "tel",
  inputMode: "numeric",
  autoComplete: "tel",
} as const;
