export type PayStatus = "unbilled" | "unpaid" | "partial" | "paid" | "over";

export function computeUnpaid(charged: number | null, paid: number): number | null {
  return charged == null ? null : charged - paid;
}

export function derivePayStatus(charged: number | null, paid: number): PayStatus {
  if (charged == null) return "unbilled";
  if (charged <= 0) return paid > 0 ? "over" : "paid";
  if (paid <= 0) return "unpaid";
  if (paid < charged) return "partial";
  if (paid === charged) return "paid";
  return "over";
}
