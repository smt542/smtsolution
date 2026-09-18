import React from "react";
import { formatPhone } from "@/lib/format";
import { Input } from "./Input";
import { applyPhoneFormat, PHONE_INPUT_ATTRS } from "./phoneField";

/**
 * 전화·팩스 번호 입력.
 *
 * 숫자만 받고 입력하는 동안 하이픈을 붙인다. 문자를 치면 그냥 무시되므로 별도 경고가 없다.
 * 포맷 규칙은 `lib/format/phone.ts`의 `formatPhone` 하나만 쓴다 — 표시용 포맷이 화면마다
 * 갈라지지 않게 하려는 것이다. 저장·비교용 숫자만 필요하면 같은 모듈의 `normalizePhone`을 쓴다.
 *
 * **props 계약은 네이티브 `<input>`과 같다.** `onChange`가 이벤트를 받고 `value`가 없으면
 * uncontrolled로 동작하므로, 이 저장소의 두 가지 기존 배선에 그대로 꽂힌다.
 *
 * ```tsx
 * <PhoneInput value={phone} onChange={(e) => setPhone(e.target.value)} />  // controlled
 * <PhoneInput {...register("phone")} />                                    // react-hook-form
 * ```
 *
 * 어느 쪽이든 핸들러가 보는 `event.target.value`는 이미 하이픈이 붙은 값이다.
 * 이 저장소가 전화번호를 표시 형태로 저장해 왔고(`setup_config.company_phone` 등),
 * 고지서·알림톡도 그 값을 그대로 찍기 때문이다.
 *
 * 한계: uncontrolled로 쓸 때 **초기값은 포맷하지 않는다.** 폼이 들고 있는 값과 화면에 보이는
 * 값이 어긋나면 안 되기 때문이다(포맷은 사용자가 입력할 때부터 적용된다).
 */
type PhoneInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

export function PhoneInput({ value, onChange, ...rest }: PhoneInputProps) {
  return (
    <Input
      {...PHONE_INPUT_ATTRS}
      // controlled일 때만 value를 넘긴다. register()처럼 value가 없으면 uncontrolled로 둔다.
      {...(value === undefined ? {} : { value: formatPhone(String(value)) })}
      onChange={(event) => {
        applyPhoneFormat(event.currentTarget);
        onChange?.(event);
      }}
      {...rest}
    />
  );
}
