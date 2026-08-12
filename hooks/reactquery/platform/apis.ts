import { createClient } from "@/lib/supabase/client";
import type { OrgMemberRole } from "@/hooks/reactquery/auth";

export type OrganizationStatus = "active" | "suspended" | "trial";

export interface PlatformOverview {
  organizationCount: number;
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

function countByOrganization(rows: Array<{ org_id: number }> | null): Map<number, number> {
  const counts = new Map<number, number>();
  for (const row of rows ?? []) {
    counts.set(row.org_id, (counts.get(row.org_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * These queries deliberately use the signed-in Supabase client. The current
 * database's my_org_ids() RLS policy therefore remains the source of truth for
 * which organizations a platform user can see.
 */
export async function getPlatformOverview(): Promise<PlatformOverview> {
  const supabase = createClient();
  const [organizations, accounts, buildings] = await Promise.all([
    supabase.from("organizations").select("id", { count: "exact", head: true }),
    supabase.from("org_members").select("user_id", { count: "exact", head: true }),
    supabase
      .from("buildings")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
  ]);

  if (organizations.error) throw new Error(organizations.error.message);
  if (accounts.error) throw new Error(accounts.error.message);
  if (buildings.error) throw new Error(buildings.error.message);

  return {
    organizationCount: organizations.count ?? 0,
    accountCount: accounts.count ?? 0,
    buildingCount: buildings.count ?? 0,
  };
}

export async function listPlatformOrganizations(): Promise<PlatformOrganization[]> {
  const supabase = createClient();
  const [organizations, members, buildings] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug, status, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("org_members").select("org_id"),
    supabase.from("buildings").select("org_id").is("deleted_at", null),
  ]);

  if (organizations.error) throw new Error(organizations.error.message);
  if (members.error) throw new Error(members.error.message);
  if (buildings.error) throw new Error(buildings.error.message);

  const accountCounts = countByOrganization(members.data);
  const buildingCounts = countByOrganization(buildings.data);

  return ((organizations.data ?? []) as OrganizationRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.created_at,
    accountCount: accountCounts.get(row.id) ?? 0,
    buildingCount: buildingCounts.get(row.id) ?? 0,
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
