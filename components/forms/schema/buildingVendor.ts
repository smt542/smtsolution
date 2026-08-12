// components/forms/schema/buildingVendor.ts
import { z } from "zod";
export const buildingVendorSchema = z.object({
  vendorType: z.enum(["elevator", "fire", "electric", "septic", "etc"]),
  name: z.string().min(1, "업체명을 입력해 주세요"),
  phone: z.string().optional(),
  memo: z.string().optional(),
});
export type BuildingVendorValues = z.infer<typeof buildingVendorSchema>;
