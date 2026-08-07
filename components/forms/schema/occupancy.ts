import { z } from "zod";

export const occupancySchema = z.object({
  tenantName: z.string().optional(),
  payerName: z.string().optional(),
  phone: z.string().optional(),
  residentCount: z.number().optional(),
  vehicleNo: z.string().optional(),
  moveInDate: z.string().optional(),
  moveOutDate: z.string().optional(),
  deposit: z.number().optional(),
  monthlyRent: z.number().optional(),
  status: z.enum(["occupied", "vacant", "moving_out"]).default("occupied"),
  memo: z.string().optional(),
});

export type OccupancyFormValues = z.infer<typeof occupancySchema>;
