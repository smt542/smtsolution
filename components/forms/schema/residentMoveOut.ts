import { z } from "zod";
import { requiredDate } from "./common";

// 세입자 퇴실 신청·희망 퇴실일 변경 — 원본 바텀시트는 날짜 하나만 받는다(사유 칸 없음)
export const moveOutDateSchema = z.object({
  desiredDate: requiredDate("희망 퇴실일을 선택해 주세요"),
});

export type MoveOutDateInput = z.input<typeof moveOutDateSchema>;
export type MoveOutDateValues = z.output<typeof moveOutDateSchema>;
