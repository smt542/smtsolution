import { createClient } from "@/lib/supabase/client";
import type { OrgMemberRole } from "@/hooks/reactquery/auth";

export type OrganizationStatus = "active" | "suspended" | "trial";

export type PointTxType = "charge" | "usage";

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
  pointBalance: number; // sum(points)
  phone: string | null;
  deletedAt: string | null;
}

export interface PlatformAccount {
  orgId: number;
  organizationName: string;
  userId: string;
  username: string | null;
  fullName: string | null;
  role: OrgMemberRole;
  isActive: boolean | null;
  createdAt: string;
}

interface OrganizationRow {
  id: number;
  name: string;
  slug: string | null;
  status: OrganizationStatus;
  created_at: string;
  phone: string | null;
  deleted_at: string | null;
}

interface MemberRow {
  org_id: number;
  user_id: string;
  role: OrgMemberRole;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  username: string;
  full_name: string;
  is_active: boolean;
}

interface PointTxRow {
  id: number;
  org_id: number;
  type: PointTxType;
  points: number;
  amount_krw: number | null;
  memo: string | null;
  created_by: string | null;
  created_at: string;
}

function countByOrganization(rows: Array<{ org_id: number }> | null): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of rows ?? []) {
    counts.set(row.org_id, (counts.get(row.org_id) ?? 0) + 1);
  }
  return counts;
}

function sumPointsByOrganization(
  rows: Array<{ org_id: number; points: number }> | null,
): Map<number, number> {
  const totals = new Map<number, number>();
  for (const row of rows ?? []) {
    totals.set(row.org_id, (totals.get(row.org_id) ?? 0) + row.points);
  }
  return totals;
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
  opts: { includeDeleted?: boolean } = {},
): Promise<PlatformOrganization[]> {
  const supabase = createClient();
  let orgQuery = supabase
    .from("organizations")
    .select("id, name, slug, status, created_at, phone, deleted_at");
  if (!opts.includeDeleted) orgQuery = orgQuery.is("deleted_at", null);
  const [organizations, members, buildings, points] = await Promise.all([
    orgQuery.order("created_at", { ascending: false }),
    supabase.from("org_members").select("org_id"),
    supabase.from("buildings").select("org_id").is("deleted_at", null),
    supabase.from("point_transactions").select("org_id, points"),
  ]);

  if (organizations.error) throw new Error(organizations.error.message);
  if (members.error) throw new Error(members.error.message);
  if (buildings.error) throw new Error(buildings.error.message);
  if (points.error) throw new Error(points.error.message);

  const accountCounts = countByOrganization(members.data);
  const buildingCounts = countByOrganization(buildings.data);
  const pointBalances = sumPointsByOrganization(
    points.data as Array<{ org_id: number; points: number }> | null,
  );

  return ((organizations.data ?? []) as OrganizationRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    accountCount: accountCounts.get(row.id) ?? 0,
    buildingCount: buildingCounts.get(row.id) ?? 0,
    pointBalance: pointBalances.get(row.id) ?? 0,
    phone: row.phone ?? null,
    deletedAt: row.deleted_at ?? null,
  }));
}

export async function listPlatformAccounts(): Promise<PlatformAccount[]> {
  const supabase = createClient();
  const [organizations, members] = await Promise.all([
    supabase.from("organizations").select("id, name"),
    supabase
      .from("org_members")
      .select("org_id, user_id, role, created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (organizations.error) throw new Error(organizations.error.message);
  if (members.error) throw new Error(members.error.message);

  const memberRows = (members.data ?? []) as MemberRow[];
  const userIds = [...new Set(memberRows.map((row) => row.user_id))];
  let profileRows: ProfileRow[] = [];

  if (userIds.length > 0) {
    const profiles = await supabase
      .from("profiles")
      .select("user_id, username, full_name, is_active")
      .in("user_id", userIds);
    if (profiles.error) throw new Error(profiles.error.message);
    profileRows = (profiles.data ?? []) as ProfileRow[];
  }

  const organizationNames = new Map<number, string>(
    (organizations.data ?? []).map((row) => [row.id, row.name]),
  );
  const profilesByUser = new Map(profileRows.map((row) => [row.user_id, row]));

  return memberRows.map((row) => {
    const profile = profilesByUser.get(row.user_id);
    return {
      orgId: row.org_id,
      organizationName: organizationNames.get(row.org_id) ?? "알 수 없는 조직",
      userId: row.user_id,
      username: profile?.username ?? null,
      fullName: profile?.full_name ?? null,
      role: row.role,
      isActive: profile?.is_active ?? null,
      createdAt: row.created_at,
    };
  });
}

export async function listPointTransactions(
  opts: { type?: PointTxType } = {},
): Promise<PointTransaction[]> {
  const supabase = createClient();

  let query = supabase
    .from("point_transactions")
    .select("id, org_id, type, points, amount_krw, memo, created_by, created_at");
  if (opts.type) query = query.eq("type", opts.type);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PointTxRow[];

  // 조직명 + 기록자명 결합
  const [organizations, profiles] = await Promise.all([
    supabase.from("organizations").select("id, name"),
    (async () => {
      const ids = [...new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v))];
      if (ids.length === 0) return { data: [] as Array<{ user_id: string; full_name: string }> };
      return supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
    })(),
  ]);
  if (organizations.error) throw new Error(organizations.error.message);
  if ("error" in profiles && profiles.error) throw new Error(profiles.error.message);

  const orgNames = new Map<number, string>(
    (organizations.data ?? []).map((o) => [o.id, o.name]),
  );
  const creatorNames = new Map<string, string>(
    ((profiles.data ?? []) as Array<{ user_id: string; full_name: string }>).map((p) => [
      p.user_id,
      p.full_name,
    ]),
  );

  return rows.map((row) => ({
    id: row.id,
    orgId: row.org_id,
    organizationName: orgNames.get(row.org_id) ?? "알 수 없는 조직",
    type: row.type,
    points: row.points,
    amountKrw: row.amount_krw,
    memo: row.memo,
    createdBy: row.created_by,
    createdByName: row.created_by ? creatorNames.get(row.created_by) ?? null : null,
    createdAt: row.created_at,
  }));
}

export async function chargePoints(input: ChargePointsInput): Promise<void> {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);

  const { error } = await supabase.from("point_transactions").insert({
    org_id: input.orgId,
    type: "charge",
    points: input.points,
    amount_krw: input.amountKrw,
    memo: input.memo ?? null,
    created_by: userData.user?.id ?? null,
  });
  if (error) throw new Error(error.message);
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
