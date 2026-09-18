import React from "react";
import { Input } from "./Input";
import { applyMask, bizRegNoMask, type InputMask, NUMERIC_INPUT_ATTRS, phoneMask, PHONE_INPUT_ATTRS } from "./maskedField";

/**
 * 마스크가 걸린 입력. 형식은 `mask`로 주입한다.
 *
 * **props 계약은 네이티브 `<input>`과 같다.** `onChange`가 이벤트를 받고 `value`가 없으면
 * uncontrolled로 동작하므로, 이 저장소의 두 가지 기존 배선에 그대로 꽂힌다.
 *
 * ```tsx
 * <MaskedInput mask={phoneMask} value={v} onChange={(e) => setV(e.target.value)} />
 * <MaskedInput mask={bizRegNoMask} {...register("bizRegNo")} />
 * ```
 *
 * 어느 쪽이든 핸들러가 보는 `event.target.value`는 이미 구분자가 붙은 값이다.
 * 이 저장소가 이런 값을 표시 형태로 저장해 왔고(`setup_config.company_phone` 등),
 * 고지서·알림톡도 그 값을 그대로 찍기 때문이다.
 *
 * 한계: uncontrolled로 쓸 때 **초기값은 마스크하지 않는다.** 폼이 들고 있는 값과 화면에 보이는
 * 값이 어긋나면 안 되기 때문이다(마스크는 사용자가 입력할 때부터 적용된다).
 */
type MaskedInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  mask: InputMask;
  type?: React.ComponentProps<typeof Input>["type"];
};

export function MaskedInput({ mask, value, onChange, ...rest }: MaskedInputProps) {
  return (
    <Input
      // controlled일 때만 value를 넘긴다. register()처럼 value가 없으면 uncontrolled로 둔다.
      {...(value === undefined ? {} : { value: mask(String(value)) })}
      onChange={(event) => {
        applyMask(event.currentTarget, mask);
        onChange?.(event);
      }}
      {...rest}
    />
  );
}

/** 전화·팩스 번호 입력. */
export function PhoneInput(props: Omit<MaskedInputProps, "mask">) {
  return <MaskedInput mask={phoneMask} {...PHONE_INPUT_ATTRS} {...props} />;
}

/** 사업자등록번호 입력. */
export function BizRegNoInput(props: Omit<MaskedInputProps, "mask">) {
  return <MaskedInput mask={bizRegNoMask} {...NUMERIC_INPUT_ATTRS} {...props} />;
}
