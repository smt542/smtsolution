export type Rounding = "up" | "round" | "down" | "raw";

export function roundCharge(value: number, r: Rounding): number {
  if (r === "up") return Math.ceil(value);
  if (r === "down") return Math.floor(value);
  return Math.round(value); // round, raw
}

export function daysInMonth(period: string): number {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m, 0).getDate(); // m(1-based)월의 0일 = 그 달 말일
}

export function occupiedDays(moveInDate: string | null, period: string): number {
  const total = daysInMonth(period);
  if (!moveInDate) return total;
  const monthStart = period.slice(0, 7); // 'YYYY-MM'
  if (moveInDate.slice(0, 7) !== monthStart) return total; // 중간입주 아님
  const day = Number(moveInDate.slice(8, 10));
  return total - day + 1; // 입주일 포함
}

export function effectiveAmount(
  base: number,
  meta: { dailyProration: boolean; rounding: Rounding },
  moveInDate: string | null,
  period: string,
): number {
  if (!meta.dailyProration) return base;
  const total = daysInMonth(period);
  const occ = occupiedDays(moveInDate, period);
  if (occ >= total) return base;
  return roundCharge((base * occ) / total, meta.rounding);
}
