import { z } from "zod";
export const leaseContractSchema = z.object({
  deposit: z.number().int().min(0).nullable().optional(),
  monthlyRent: z.number().int().min(0).nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  expiryAlert: z.boolean(),
});
export type LeaseContractValues = z.infer<typeof leaseContractSchema>;
