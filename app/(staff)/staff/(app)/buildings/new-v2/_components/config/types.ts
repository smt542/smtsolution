export type FieldKind = "text" | "textarea" | "readonly" | "select" | "date";

import type { InputMask } from "@/components/common";

export interface FieldDef {
  label: string;
  kind: FieldKind;
  /** 숫자 입력에 구분자를 끼우는 마스크. kind는 그대로 두고 형식만 준다. */
  mask?: InputMask;
  placeholder?: string;
  options?: string[];
  full?: boolean;
  defaultValue?: string;
  minHeight?: number;
}
