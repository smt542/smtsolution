import { effectiveAmount, type Rounding } from "./proration";

export interface ChargeLine {
  charged: boolean;
  amount: number;
  dailyProration: boolean;
  rounding: Rounding;
}

export function unitTotal(lines: ChargeLine[], moveInDate: string | null, period: string): number {
  return lines.reduce((sum, l) => {
    if (!l.charged) return sum;
    return sum + effectiveAmount(l.amount, { dailyProration: l.dailyProration, rounding: l.rounding }, moveInDate, period);
  }, 0);
}
