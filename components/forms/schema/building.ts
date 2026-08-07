import { z } from "zod";

export const buildingSchema = z.object({
  code: z.string().min(1, "코드를 입력해 주세요"),
  name: z.string().min(1, "건물명을 입력해 주세요"),
  address: z.string().optional(),
  typeId: z.number().nullable().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  entrancePassword: z.string().optional(),
  managerName: z.string().optional(),
  meterStaffName: z.string().optional(),
  cleaningStaffName: z.string().optional(),
  memo: z.string().optional(),
});

export type BuildingFormValues = z.infer<typeof buildingSchema>;
