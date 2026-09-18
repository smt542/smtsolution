"use client";

import React, { useLayoutEffect, useRef } from "react";
import { formatPhone } from "@/lib/format";
import { Input } from "./Input";

/**
 * 전화·팩스 번호 입력.
 *
 * 숫자만 받고 입력하는 동안 하이픈을 붙인다. 문자를 치면 그냥 무시되므로 별도 경고가 없다.
 * 포맷 규칙은 `lib/format/phone.ts`의 `formatPhone` 하나만 쓴다 — 표시용 포맷이 화면마다
 * 갈라지지 않게 하려는 것이다. 저장·비교용 숫자만 필요하면 같은 모듈의 `normalizePhone`을 쓴다.
 *
 * `onChange`는 하이픈이 붙은 표시값을 그대로 돌려준다. 이 저장소가 전화번호를 표시 형태로
 * 저장해 왔고(`setup_config.company_phone` 등), 고지서·알림톡도 그 값을 그대로 찍기 때문이다.
 */
type PhoneInputProps = Omit<
  React.ComponentPropsWithRef<"input">,
  "value" | "onChange" | "type" | "size"
> & {
  value: string;
  onChange: (value: string) => void;
  size?: React.ComponentProps<typeof Input>["size"];
};

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

export function PhoneInput({ value, onChange, ...rest }: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // 포맷 때문에 길이가 바뀌면 브라우저가 커서를 끝으로 보낸다. 중간을 고칠 때 커서가
  // 튀지 않도록 "커서 앞 숫자 개수"를 기준으로 되돌려 놓는다.
  const caretRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const element = inputRef.current;
    if (!element || caretRef.current === null) return;
    element.setSelectionRange(caretRef.current, caretRef.current);
    caretRef.current = null;
  });

  return (
    <Input
      ref={inputRef}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      value={formatPhone(value)}
      onChange={(event) => {
        const element = event.currentTarget;
        const raw = stripCountryCode(element.value);
        const selection = element.selectionStart ?? raw.length;
        const digitsBeforeCaret = raw.slice(0, selection).replace(/\D/g, "").length;
        const next = formatPhone(raw);
        caretRef.current = caretAfterDigits(next, digitsBeforeCaret);
        onChange(next);
      }}
      {...rest}
    />
  );
}
