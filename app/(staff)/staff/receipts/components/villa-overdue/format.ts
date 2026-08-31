/** 'YYYY-MM-01' | 'YYYY-MM' → 'YYYY/MM' (Figma 년월 표기). */
export function formatPeriodSlash(period: string): string {
  return period.slice(0, 7).replace("-", "/");
}

/** 필터 '00'~'12' 라벨 (연체 개월 하한). */
export function padMonthCount(value: number): string {
  return String(value).padStart(2, "0");
}
