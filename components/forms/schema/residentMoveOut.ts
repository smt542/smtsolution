import { z } from "zod";
import { nullableTrimmedString, requiredDate } from "./common";

export const moveOutCreateSchema = z.object({
  desiredDate: requiredDate("희망 퇴실일을 입력해 주세요"),
  reason: nullableTrimmedString(500, "사유는 500자 이하로 입력해 주세요"),
});

export const moveOutUpdateSchema = z.object({
  desiredDate: requiredDate("새 희망 퇴실일을 입력해 주세요"),
});

export type MoveOutCreateInput = z.input<typeof moveOutCreateSchema>;
export type MoveOutCreateValues = z.output<typeof moveOutCreateSchema>;
export type MoveOutUpdateInput = z.input<typeof moveOutUpdateSchema>;
export type MoveOutUpdateValues = z.output<typeof moveOutUpdateSchema>;
