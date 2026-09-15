import { z } from "zod";
import { optionalInteger, requiredInteger } from "./common";

export const messagePointRatesSchema = z.object({
  smsPoints: requiredInteger("SMS 단가를 입력해 주세요").pipe(
    z.number().positive("SMS 단가는 1 이상이어야 합니다"),
  ),
  alimtalkPoints: requiredInteger("알림톡 단가를 입력해 주세요").pipe(
    z.number().positive("알림톡 단가는 1 이상이어야 합니다"),
  ),
  // LMS 단가는 선택. 비우면 변경하지 않는다(미설정 상태 허용).
  lmsPoints: optionalInteger("LMS 단가는 정수로 입력해 주세요").pipe(
    z.number().positive("LMS 단가는 1 이상이어야 합니다").optional(),
  ),
});

export type MessagePointRatesFormInput = z.input<typeof messagePointRatesSchema>;
export type MessagePointRatesFormValues = z.output<typeof messagePointRatesSchema>;
