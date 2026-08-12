import { z } from "zod";
export const unitMeterSchema = z.object({
  utility: z.enum(["water", "elec", "gas"]),
  meterNo: z.string().optional(),
  customerNo: z.string().optional(),
});
export type UnitMeterValues = z.infer<typeof unitMeterSchema>;
