/** "2026-08-12" → "2026.08.12" */
export function formatDotDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${year}.${month}.${day}`;
}

/** "그린빌라 302 · 정민수" 형태의 세대 라벨 (세대주 없으면 건물·호실만). */
export function householdLabel(h: {
  buildingName: string;
  dong?: string | null;
  unitNo: string;
  tenantName?: string | null;
}): string {
  const place = [h.buildingName, h.dong, h.unitNo].filter(Boolean).join(" ");
  return h.tenantName ? `${place} · ${h.tenantName}` : place;
}
