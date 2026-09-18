import { formatPhone } from "@/lib/format";

/**
 * 숫자를 받아 구분자를 끼워 보여주는 입력의 공통 동작.
 *
 * 화면마다 입력 래퍼가 다르다(`Input`, 건물 등록의 `TextField`, 입주자폼의 `TextField`,
 * 운영사 설정의 `TextSetting`, 그리고 자체 클래스를 쓰는 네이티브 input 몇 개).
 * 래퍼는 저마다 스타일·props 계약이 달라 하나로 합칠 수 없지만, "숫자만 남기고 구분자를 끼우고
 * 커서를 보존한다"는 동작은 같다. 그 동작만 여기 모아 공유한다.
 *
 * **형식은 마스크 함수로 주입한다.** 커서 보존 알고리즘이 "커서 앞 숫자 개수"를 기준으로 하므로
 * 숫자 사이에 구분자만 끼우는 마스크라면 형식이 무엇이든 그대로 동작한다. 형식이 늘 때
 * 래퍼들을 고칠 필요가 없다.
 */
export type InputMask = (raw: string) => string;

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
 * 입력 요소의 값에 마스크를 적용하고 커서를 보존한다. 적용된 값을 돌려준다.
 *
 * 값을 DOM에 직접 써 넣는 이유는 두 가지다.
 * - controlled 래퍼: 핸들러가 `event.target.value`에서 마스크된 값을 그대로 읽는다
 * - uncontrolled 래퍼(react-hook-form `register`): 폼이 기록하는 값이 마스크된 값이 된다
 *
 * 마스크 때문에 길이가 바뀌면 브라우저가 커서를 끝으로 보내므로, "커서 앞 숫자 개수"를
 * 기준으로 되돌려 놓는다. 중간을 고칠 때 커서가 튀지 않게 하려는 것이다.
 */
export function applyMask(element: HTMLInputElement, mask: InputMask): string {
  const raw = element.value;
  const selection = element.selectionStart ?? raw.length;
  const digitsBeforeCaret = raw.slice(0, selection).replace(/\D/g, "").length;
  const next = mask(raw);

  element.value = next;
  const caret = caretAfterDigits(next, digitsBeforeCaret);
  element.setSelectionRange(caret, caret);
  return next;
}

/**
 * 전화·팩스 번호. 규칙은 `lib/format/phone.ts`의 `formatPhone` 하나만 쓴다 —
 * 표시용 포맷이 화면마다 갈라지지 않게 하려는 것이다.
 *
 * 국제표기로 붙여넣은 값은 국내표기로 바꾼다. `+`가 있을 때만 건드리므로
 * 타이핑 중에 `82`를 쳤다고 갑자기 `0`으로 변하는 일은 없다.
 */
export const phoneMask: InputMask = (raw) => {
  const domestic = raw.trimStart().startsWith("+82")
    ? `0${raw.replace(/^\s*\+82/, "")}`
    : raw;
  return formatPhone(domestic);
};

/** 사업자등록번호 10자리 — `000-00-00000`. */
export const bizRegNoMask: InputMask = (raw) => {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
};

/** 숫자만 입력받는 필드의 공통 HTML 속성. */
export const NUMERIC_INPUT_ATTRS = { inputMode: "numeric" } as const;

/** 전화번호 입력의 공통 HTML 속성. */
export const PHONE_INPUT_ATTRS = {
  type: "tel",
  inputMode: "numeric",
  autoComplete: "tel",
} as const;
