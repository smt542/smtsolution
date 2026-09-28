import type { FeeItem } from "@/hooks/reactquery/feeItems";

// 연체료·가산금 항목은 별도 연체료 메트릭으로 합산하므로 관리비 항목 열에서 제외한다.
export const LATE_FEE_PATTERN = /연체|가산/;

interface SnapshotFeeItem {
  feeItemId: number;
  name: string;
}

export function orderFeeItems(
  configuredFeeItems: ReadonlyArray<Pick<FeeItem, "id" | "name" | "sortOrder">> | undefined,
  snapshotFeeItems: ReadonlyArray<SnapshotFeeItem>,
): Array<{ feeItemId: number; name: string }> {
  const configured = configuredFeeItems ?? [];
  const configuredIds = new Set(configured.map((item) => item.id));
  const configuredItems = configured
    .filter((item) => !LATE_FEE_PATTERN.test(item.name))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((item) => ({ feeItemId: item.id, name: item.name }));

  const snapshotOnlyNames = new Map<number, string>();
  for (const item of snapshotFeeItems) {
    if (
      configuredIds.has(item.feeItemId) ||
      LATE_FEE_PATTERN.test(item.name) ||
      snapshotOnlyNames.has(item.feeItemId)
    ) {
      continue;
    }
    snapshotOnlyNames.set(item.feeItemId, item.name);
  }

  const snapshotOnlyItems = [...snapshotOnlyNames.entries()]
    .sort(([firstId], [secondId]) => firstId - secondId)
    .map(([feeItemId, name]) => ({ feeItemId, name }));

  return [...configuredItems, ...snapshotOnlyItems];
}
