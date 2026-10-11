import type { StaffType } from "@/hooks/reactquery/auth";

/** 현장 표면 capability. 사무실 표면은 manager_staff 하나다. */
const FIELD_CAPABILITIES: StaffType[] = ["field_staff", "support_staff"];

export function isFieldStaffType(type: StaffType | null | undefined): boolean {
  return type === "field_staff" || type === "support_staff";
}

/** 사무실(manager_staff)과 현장(field_staff/support_staff) capability를 모두 가진 계정인지. */
export function isDualCapability(caps: readonly StaffType[] | null | undefined): boolean {
  const list = caps ?? [];
  return list.includes("manager_staff") && list.some((c) => FIELD_CAPABILITIES.includes(c));
}

/**
 * 겸직 토글 값을 반영한 capability 목록.
 * 주 유형(primary)은 항상 포함하고, 반대편 표면(사무실 <-> 현장)만 토글로 넣고 뺀다.
 * 그 밖의 기존 capability(예: tenant)는 보존한다.
 */
export function buildStaffCapabilities(
  primary: StaffType,
  existing: readonly StaffType[] | null | undefined,
  alsoCrossApp: boolean,
): StaffType[] {
  const primaryIsField = isFieldStaffType(primary);
  const crossSet: StaffType[] = primaryIsField ? ["manager_staff"] : FIELD_CAPABILITIES;
  const kept = (existing ?? []).filter((c) => !crossSet.includes(c) && c !== primary);
  const cross: StaffType[] = alsoCrossApp ? [primaryIsField ? "manager_staff" : "field_staff"] : [];
  // 기존에 지원(support_staff) 겸직이었다면 그 값을 유지한다.
  const existingCross = (existing ?? []).filter((c) => crossSet.includes(c));
  return [primary, ...kept, ...(alsoCrossApp ? (existingCross.length > 0 ? existingCross : cross) : [])];
}
