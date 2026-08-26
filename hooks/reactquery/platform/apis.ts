import { createClient } from "@/lib/supabase/client";
import type { OrgMemberRole, StaffType } from "@/hooks/reactquery/auth";

export type OrganizationStatus = "active" | "suspended" | "trial";
export type PlatformOrganizationStatusFilter = "operating" | "suspended" | "terminated";

export type PointTxType = "charge" | "usage" | "adjustment";

export type PointAdjustmentKind = "correction" | "deduction" | "refund";

export interface PointTransaction {
  id: number;
  orgId: number;
  organizationName: string;
  type: PointTxType;
  points: number;
  amountKrw: number | null;
  memo: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface ChargePointsInput {
  orgId: number;
  points: number;   // > 0
  amountKrw: number; // >= 0
  memo?: string | null;
}

export interface AdjustPointsInput {
  orgId: number;
  kind: PointAdjustmentKind;
  points: number; // correction: +/-; deduction/refund: negative
  amountKrw?: number | null; // refund only
  memo: string;
}

export interface PlatformOverview {
  activeOrganizationCount: number;
  accountCount: number;
  buildingCount: number;
}

export interface PlatformOrganization {
  id: number;
  name: string;
  slug: string | null;
  status: OrganizationStatus;
  createdAt: string;
  accountCount: number;
  buildingCount: number;
  pointBalance: number; // ledgerBalance 호환 별칭
  ledgerBalance: number;
  reservedPoints: number;
  availablePoints: number;
  phone: string | null;
  deletedAt: string | null;
}

export interface PlatformAccount {
  orgId: number;
  organizationName: string;
  userId: string;
  username: string | null;
  fullName: string | null;
  phone: string | null;
  role: OrgMemberRole;
  staffType: StaffType;
  permissions: string[];
  isActive: boolean | null;
  createdAt: string;
}

export interface PaginatedResult<T> {
  rows: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface PlatformOrganizationQuery {
  includeDeleted?: boolean;
  status?: PlatformOrganizationStatusFilter;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PlatformAccountQuery {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PointTransactionCursor {
  createdAt: string;
  id: number;
}

export interface PointTransactionQuery {
  type?: PointTxType;
  cursor?: PointTransactionCursor | null;
  pageSize?: number;
}

export interface PointTransactionPage {
  rows: PointTransaction[];
  totalCount: number;
  nextCursor: PointTransactionCursor | null;
  pageSize: number;
}

interface OrganizationRpcRow {
  id: number;
  name: string;
  slug: string | null;
  status: OrganizationStatus;
  created_at: string;
  phone: string | null;
  deleted_at: string | null;
  account_count: number | string;
  building_count: number | string;
  ledger_balance: number | string;
  reserved_points: number | string;
  available_points: number | string;
  total_count: number | string;
}

interface AccountRpcRow {
  org_id: number;
  organization_name: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  role: OrgMemberRole;
  staff_type: StaffType;
  feature_permissions: unknown;
  is_active: boolean | null;
  created_at: string;
  total_count: number | string;
}

interface ProfilePhoneRow {
  user_id: string;
  phone: string | null;
}

interface PointTxRpcRow {
  id: number;
  org_id: number;
  organization_name: string;
  type: PointTxType;
  points: number;
  amount_krw: number | null;
  memo: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  total_count: number | string;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value ?? 0) > 0 ? value as number : fallback;
}

function mapPlatformOrganization(row: OrganizationRpcRow): PlatformOrganization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    accountCount: Number(row.account_count),
    buildingCount: Number(row.building_count),
    pointBalance: Number(row.ledger_balance),
    ledgerBalance: Number(row.ledger_balance),
    reservedPoints: Number(row.reserved_points),
    availablePoints: Number(row.available_points),
    phone: row.phone ?? null,
    deletedAt: row.deleted_at ?? null,
  };
}

function matchesOrganizationStatus(
  row: PlatformOrganization,
  status: PlatformOrganizationStatusFilter,
): boolean {
  if (status === "terminated") return row.deletedAt !== null;
  if (row.deletedAt !== null) return false;
  if (status === "suspended") return row.status === "suspended";
  return row.status === "active" || row.status === "trial";
}

/**
 * These queries deliberately use the signed-in Supabase client. The current
 * database's my_org_ids() RLS policy therefore remains the source of truth for
 * which organizations a platform user can see.
 */
export async function getPlatformOverview(): Promise<PlatformOverview> {
  const supabase = createClient();
  const [activeOrganizations, accounts, buildings] = await Promise.all([
    supabase
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase.from("org_members").select("user_id", { count: "exact", head: true }),
    supabase
      .from("buildings")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
  ]);

  if (activeOrganizations.error) throw new Error(activeOrganizations.error.message);
  if (accounts.error) throw new Error(accounts.error.message);
  if (buildings.error) throw new Error(buildings.error.message);

  return {
    activeOrganizationCount: activeOrganizations.count ?? 0,
    accountCount: accounts.count ?? 0,
    buildingCount: buildings.count ?? 0,
  };
}

export async function listPlatformOrganizations(
  opts: PlatformOrganizationQuery = {},
): Promise<PaginatedResult<PlatformOrganization>> {
  const page = positiveInteger(opts.page, 1);
  const pageSize = Math.min(positiveInteger(opts.pageSize, 25), 100);
  const client = createClient();
  const fetchRows = async (limit: number, offset: number): Promise<OrganizationRpcRow[]> => {
    const { data, error } = await client.rpc("platform_list_organizations", {
      p_search: opts.search?.trim() || null,
      p_include_deleted: opts.status ? true : opts.includeDeleted ?? false,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as OrganizationRpcRow[];
  };

  if (opts.status) {
    const allRows: OrganizationRpcRow[] = [];
    let offset = 0;
    let totalCount = 0;

    do {
      const chunk = await fetchRows(100, offset);
      if (chunk.length === 0) break;
      allRows.push(...chunk);
      offset += chunk.length;
      totalCount = Number(chunk[0].total_count);
    } while (offset < totalCount);

    const matchingRows = allRows
      .map(mapPlatformOrganization)
      .filter((row) => matchesOrganizationStatus(row, opts.status!));
    return {
      rows: matchingRows.slice((page - 1) * pageSize, page * pageSize),
      totalCount: matchingRows.length,
      page,
      pageSize,
    };
  }

  const rows = await fetchRows(pageSize, (page - 1) * pageSize);

  return {
    rows: rows.map(mapPlatformOrganization),
    totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    pageSize,
  };
}

export async function listPlatformAccounts(
  opts: PlatformAccountQuery = {},
): Promise<PaginatedResult<PlatformAccount>> {
  const page = positiveInteger(opts.page, 1);
  const pageSize = Math.min(positiveInteger(opts.pageSize, 25), 100);
  const client = createClient();
  const { data, error } = await client.rpc("platform_list_accounts", {
    p_search: opts.search?.trim() || null,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as AccountRpcRow[];
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const phoneByUserId = new Map<string, string | null>();

  if (userIds.length > 0) {
    const { data: profileData, error: profileError } = await client
      .from("profiles")
      .select("user_id, phone")
      .in("user_id", userIds);
    if (profileError) throw new Error(profileError.message);
    for (const profile of (profileData ?? []) as ProfilePhoneRow[]) {
      phoneByUserId.set(profile.user_id, profile.phone);
    }
  }

  return {
    rows: rows.map((row) => ({
      orgId: row.org_id,
      organizationName: row.organization_name,
      userId: row.user_id,
      username: row.username,
      fullName: row.full_name,
      phone: phoneByUserId.get(row.user_id) ?? null,
      role: row.role,
      staffType: row.staff_type,
      permissions: Array.isArray(row.feature_permissions) ? row.feature_permissions : [],
      isActive: row.is_active,
      createdAt: row.created_at,
    })),
    totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    pageSize,
  };
}

export async function listPointTransactions(
  opts: PointTransactionQuery = {},
): Promise<PointTransactionPage> {
  const pageSize = Math.min(positiveInteger(opts.pageSize, 50), 100);
  const { data, error } = await createClient().rpc("platform_list_point_transactions", {
    p_type: opts.type ?? null,
    p_before_created_at: opts.cursor?.createdAt ?? null,
    p_before_id: opts.cursor?.id ?? null,
    p_limit: pageSize,
  });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PointTxRpcRow[];
  const lastRow = rows.at(-1);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      orgId: row.org_id,
      organizationName: row.organization_name,
      type: row.type,
      points: row.points,
      amountKrw: row.amount_krw,
      memo: row.memo,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
    })),
    totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0,
    nextCursor: lastRow ? { createdAt: lastRow.created_at, id: lastRow.id } : null,
    pageSize,
  };
}

export async function chargePoints(input: ChargePointsInput): Promise<void> {
  if (!Number.isInteger(input.points) || input.points <= 0) {
    throw new Error("충전 포인트는 1 이상의 정수여야 합니다.");
  }
  if (!Number.isInteger(input.amountKrw) || input.amountKrw < 0) {
    throw new Error("결제금액은 0 이상의 정수여야 합니다.");
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc("platform_record_point_charge", {
    p_org_id: input.orgId,
    p_points: input.points,
    p_amount_krw: input.amountKrw,
    p_memo: input.memo?.trim() || null,
  });
  if (error) throw new Error(error.message);
  assertPointOperationResult(data);
}

export async function adjustPoints(input: AdjustPointsInput): Promise<void> {
  if (!Number.isInteger(input.points) || input.points === 0) {
    throw new Error("조정 포인트는 0이 아닌 정수여야 합니다.");
  }
  if (input.kind !== "correction" && input.points >= 0) {
    throw new Error("차감·환불 포인트는 음수여야 합니다.");
  }
  const memo = input.memo.trim();
  if (!memo) throw new Error("조정 사유를 입력해 주세요.");

  const supabase = createClient();
  const { data, error } = await supabase.rpc("platform_record_point_adjustment", {
    p_org_id: input.orgId,
    p_kind: input.kind,
    p_points: input.points,
    p_amount_krw: input.kind === "refund" ? input.amountKrw ?? null : null,
    p_memo: memo,
  });
  if (error) throw new Error(error.message);
  assertPointOperationResult(data);
}

function assertPointOperationResult(data: unknown): void {
  const result = data as {
    ok?: boolean;
    code?: string;
    reserved_points?: number;
  } | null;
  if (result?.ok) return;

  if (result?.code === "POINTS_RESERVED") {
    throw new Error(
      `활성 메시지 예약 ${Number(result.reserved_points ?? 0).toLocaleString("ko-KR")} P를 침범해 조정할 수 없습니다.`,
    );
  }
  if (result?.code === "INSUFFICIENT_POINTS") {
    throw new Error("보유 포인트보다 많이 차감할 수 없습니다.");
  }
  throw new Error("포인트 원장 기록에 실패했습니다.");
}

export async function updateOrganizationStatus(
  id: number,
  status: OrganizationStatus,
): Promise<void> {
  const { error } = await createClient()
    .from("organizations")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export interface CreateOrgInput {
  name: string; slug: string; phone?: string | null;
  owner: { username: string; fullName: string; phone?: string | null };
}

export interface CreateOrgResult {
  organization: { id: number; name: string; slug: string | null };
  owner: { username: string; tempPassword: string };
}

export async function createPlatformOrganization(input: CreateOrgInput): Promise<CreateOrgResult> {
  const res = await fetch("/api/platform/organizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "조직 생성에 실패했습니다.");
  return json as CreateOrgResult;
}

export interface UpdateOrgInput { name: string; slug: string; phone?: string | null }

export async function updatePlatformOrganization(id: number, input: UpdateOrgInput): Promise<void> {
  const { error } = await createClient()
    .from("organizations")
    .update({ name: input.name, slug: input.slug || null, phone: input.phone || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setPlatformOrganizationDeleted(id: number, deleted: boolean): Promise<void> {
  const { error } = await createClient()
    .from("organizations")
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
