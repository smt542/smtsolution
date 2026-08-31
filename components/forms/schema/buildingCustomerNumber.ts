// components/forms/schema/buildingCustomerNumber.ts
import { z } from "zod";
export const customerNumberSchema = z.object({
  kind: z.enum(["water", "common_elec", "elec", "gas"]),
  customerNo: z.string().min(1, "고객번호를 입력해 주세요"),
  lineName: z.string().max(30).optional(),
  meterDay: z.number().int().min(1).max(28).nullable().optional(),
  billingBasis: z.enum(["prev", "current"]),
  calculationMethod: z.enum(["auto", "manual"]).default("auto"),
  note: z.string().max(300).optional(),
  printOnBill: z.boolean(),
  holderName: z.string().optional(),
});
export type CustomerNumberValues = z.infer<typeof customerNumberSchema>;
