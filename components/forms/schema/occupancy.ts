import { z } from "zod";
export const occupancyBasicSchema = z.object({
  unitNo: z.string().min(1, "호실명을 입력해 주세요"),
  tenantName: z.string().min(1, "이름을 입력해 주세요"),
  payerName: z.string().min(1, "입금자명을 입력해 주세요"),
  phone: z.string().min(1, "연락처를 입력해 주세요"),
  phone2: z.string().optional(),
  phone3: z.string().optional(),
  vehicleNo: z.string().optional(),
  residentCount: z.number().int().min(0).nullable().optional(),
  roomTypeId: z.number().int().positive({ message: "룸타입을 선택해 주세요" }),
  moveInDate: z.string().min(1, "입주일을 선택해 주세요"),
});
export const occupancyBillingSchema = z.object({
  status: z.enum(["occupied", "vacant", "moving_out"]),
  moveOutDate: z.string().optional(),
  billingEnabled: z.boolean(),
  printEnabled: z.boolean(),
  lateFeeEnabled: z.boolean(),
  singlePrint: z.boolean(),
  billingNote: z.string().optional(),
  settlementNote: z.string().optional(),
});
export type OccupancyBasicValues = z.infer<typeof occupancyBasicSchema>;
export type OccupancyBillingValues = z.infer<typeof occupancyBillingSchema>;
