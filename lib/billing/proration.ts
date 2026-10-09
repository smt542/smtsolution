export type Rounding = "up" | "round" | "down" | "raw";

export function roundCharge(value: number, r: Rounding): number {
  // 계산규칙 1.2: 절상·4사5입·절하는 10원 단위, 그대로(raw)는 반올림 미적용
  if (r === "raw") return Math.round(value);
  if (r === "up") return Math.ceil(value / 10) * 10;
  if (r === "down") return Math.floor(value / 10) * 10;
  return Math.round(value / 10) * 10; // 4사5입(10원 단위)
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
  // 계산규칙 1.1: 일할 분모는 그 달 일수와 무관하게 고정 30일
  return roundCharge((base * occ) / 30, meta.rounding);
}
