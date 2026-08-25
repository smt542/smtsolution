import { z } from "zod";

export const messagePointRatesSchema = z.object({
  smsPoints: z.coerce.number().int().positive("SMS 단가는 1 이상이어야 합니다"),
  alimtalkPoints: z.coerce
    .number()
    .int()
    .positive("알림톡 단가는 1 이상이어야 합니다"),
  // LMS 단가는 선택. 비우면 변경하지 않는다(미설정 상태 허용).
  lmsPoints: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive("LMS 단가는 1 이상이어야 합니다").optional(),
  ),
});

export type MessagePointRatesFormValues = z.output<typeof messagePointRatesSchema>;
