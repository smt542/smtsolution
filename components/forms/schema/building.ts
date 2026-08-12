// components/forms/schema/building.ts
import { z } from "zod";

export const facilityFlagSchema = z.object({ on: z.boolean(), memo: z.string() });
export const facilitiesSchema = z.object({
  cctv: facilityFlagSchema, elevator: facilityFlagSchema, cleaning: facilityFlagSchema,
  metering: facilityFlagSchema, management: facilityFlagSchema, septic: facilityFlagSchema,
  internet: facilityFlagSchema, electric_safety: facilityFlagSchema, fire_safety: facilityFlagSchema,
});

export const buildingBasicSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "건물명을 입력해 주세요"),
  address: z.string().min(1, "주소를 입력해 주세요"),
  managerUserId: z.string().uuid().nullable().optional(),
  meterUserId: z.string().uuid().nullable().optional(),
  cleaningUserId: z.string().uuid().nullable().optional(),
  memo: z.string().max(1000, "참고사항은 1000자 이내로 입력해 주세요").optional(),
});

export type BuildingBasicValues = z.infer<typeof buildingBasicSchema>;
export type FacilitiesValues = z.infer<typeof facilitiesSchema>;
