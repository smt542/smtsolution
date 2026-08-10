import type { MyContext } from "@/hooks/reactquery/auth/apis";

/** Module keys — align with DB permission strings */
export type ModuleKey =
  | "buildings"
  | "billing"
  | "fee_items"
  | "arrears"
  | "move_settle"
  | "setup"
  | "accounts"
  | "vendors";

export const MODULE_LABELS: Record<ModuleKey, string> = {
  buildings: "건물·입주자",
  billing: "청구",
  fee_items: "관리비 셋팅",
  arrears: "수납·미납",
  move_settle: "이사정산",
  setup: "셋업 설정",
  accounts: "계정·권한",
  vendors: "협력업체",
};

/**
 * Returns true if the user has access to a given module.
 * org_owner is granted all modules unconditionally.
 */
export function hasModule(ctx: MyContext | null | undefined, key: ModuleKey): boolean {
  if (!ctx) return false;
  if (ctx.role === "org_owner" || ctx.role === "platform_admin") return true;
  return (ctx.permissions ?? []).includes(key);
}

/**
 * Returns true if the user can manage accounts (create/edit staff).
 * Only org_owner (or platform_admin) can; managers with explicit "accounts" permission can too.
 */
export function canManageAccounts(ctx: MyContext | null | undefined): boolean {
  return hasModule(ctx, "accounts");
}
