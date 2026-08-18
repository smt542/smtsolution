import { z } from "zod";

export const messagePointRatesSchema = z.object({
  smsPoints: z.coerce.number().int().positive("SMS 단가는 1 이상이어야 합니다"),
  alimtalkPoints: z.coerce
    .number()
    .int()
    .positive("알림톡 단가는 1 이상이어야 합니다"),
});

export type MessagePointRatesFormValues = z.output<typeof messagePointRatesSchema>;
