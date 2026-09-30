import { z } from "zod";

export const feeItemSchema = z.object({
  name: z.string().trim().min(1, "항목명을 입력해 주세요").max(30, "항목명은 30자 이하로 입력해 주세요"),
  rounding: z.enum(["up", "round", "down", "raw"]).default("round"),
  dailyProration: z.boolean().default(false),
  carryOver: z.boolean().default(false),
  sortOrder: z.number().optional(),
  typeId: z.number().nullable().optional(),
});

const SELECT_ALL_MESSAGE = "반올림·일자계산·이월을 모두 선택해 주세요";

/**
 * 항목등록 관리 모달(/staff/fee-items). 정본 fee-item처럼 새 항목은 반올림·일자계산·이월을
 * 기본값 없이 비워 두고, 셋 다 골라야 저장된다. 관리비 화면이 쓰는 `feeItemSchema`의 기본값은 그대로다.
 */
export function createFeeItemSchema(existingNames: string[]) {
  const normalized = new Set(existingNames.map((name) => name.trim()));
  return z
    .object({
      name: feeItemSchema.shape.name,
      rounding: z.enum(["up", "round", "down", "raw"], { required_error: SELECT_ALL_MESSAGE }),
      dailyProration: z.boolean({ required_error: SELECT_ALL_MESSAGE }),
      carryOver: z.boolean({ required_error: SELECT_ALL_MESSAGE }),
    })
    .refine((value) => !normalized.has(value.name), {
      path: ["name"],
      message: "이미 등록된 항목 명칭입니다.",
    });
}

export type FeeItemFormInput = z.input<ReturnType<typeof createFeeItemSchema>>;
export type FeeItemFormValues = z.output<ReturnType<typeof createFeeItemSchema>>;
