import { z } from "zod";
export const unitAccountSchema = z.object({
  kind: z.enum(["water", "elec", "gas", "mgmt"]),
  bank: z.string().optional(),
  account: z.string().optional(),
  holder: z.string().optional(),
  cmsMemberNo: z.string().optional(),
});
export type UnitAccountValues = z.infer<typeof unitAccountSchema>;
