import { createClient } from "@/lib/supabase/client";
import {
  imageMimeTypeFromFileName,
  normalizeAttachmentFileName,
  validateAttachmentFile,
} from "@/lib/attachments/policy";
import { createPrivateAssetSignedUrl } from "@/lib/attachments/signedUrl";
import { formatNumber } from "@/lib/format";

// 정본 조직 상태 = 운영·정지(해지는 deleted_at). org_status 타입의 'trial'은 쓰지 않는다(0207).
export type OrganizationStatus = "active" | "suspended";
export type PlatformOrganizationStatusFilter = "operating" | "suspended" | "terminated";
export type HqRole = "master" | "operations" | "support" | "sales" | "accounting" | "other";

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
  contractStartDate: string | null;
  contractEndDate: string | null;
  representativeName: string | null;
  businessRegistrationNumber: string | null;
  fax: string | null;
  email: string | null;
  address: string | null;
  region: string | null;
  operatingHours: string | null;
  /** 계약서 사진 경로들(정본 '여러 장 가능', 0209) */
  contractFilePaths: string[];
  unitCount: number;
  employeeCount: number;
  tenantCount: number;
}

export interface PlatformOrganizationContractKpis {
  operatingCount: number;
  expiringWithin90DaysCount: number;
  suspendedCount: number;
  terminatedLast12MonthsCount: number;
}

export interface PlatformHqAccount {
  userId: string;
  username: string;
  fullName: string;
  phone: string;
  memo: string | null;
  hqRole: HqRole | null;
  isActive: boolean;
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

export interface PlatformHqAccountQuery {
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
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  representative_name?: string | null;
  business_registration_number?: string | null;
  fax?: string | null;
  email?: string | null;
  address?: string | null;
  region?: string | null;
  operating_hours?: string | null;
  contract_file_path?: string | null;
  contract_file_paths?: string[] | null;
  account_count: number | string;
  building_count: number | string;
  unit_count?: number | string;
  employee_count?: number | string;
  tenant_count?: number | string;
  ledger_balance: number | string;
  reserved_points: number | string;
  available_points: number | string;
  total_count: number | string;
}

interface HqAccountRpcRow {
  user_id: string;
  username: string;
  full_name: string;
  phone: string;
  memo: string | null;
  hq_role: HqRole | null;
  is_active: boolean;
  created_at: string;
  total_count: number | string;
}

interface OrganizationContractKpiRpcRow {
  operating_count: number | string;
  expiring_within_90_days_count: number | string;
  suspended_count: number | string;
  terminated_last_12_months_count: number | string;
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
    contractStartDate: row.contract_start_date ?? null,
    contractEndDate: row.contract_end_date ?? null,
    representativeName: row.representative_name ?? null,
    businessRegistrationNumber: row.business_registration_number ?? null,
    fax: row.fax ?? null,
    email: row.email ?? null,
    address: row.address ?? null,
    region: row.region ?? null,
    operatingHours: row.operating_hours ?? null,
    contractFilePaths: row.contract_file_paths ?? (row.contract_file_path ? [row.contract_file_path] : []),
    unitCount: Number(row.unit_count ?? 0),
    employeeCount: Number(row.employee_count ?? 0),
    tenantCount: Number(row.tenant_count ?? 0),
  };
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
  const { data, error } = await client.rpc("platform_list_organizations", {
    p_search: opts.search?.trim() || null,
    p_include_deleted: opts.status ? true : opts.includeDeleted ?? false,
    p_status: opts.status ?? null,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as OrganizationRpcRow[];

  return {
    rows: rows.map(mapPlatformOrganization),
    totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page,
    pageSize,
  };
}

export async function getPlatformOrganizationContractKpis(): Promise<PlatformOrganizationContractKpis> {
  const { data, error } = await createClient().rpc("platform_get_organization_contract_kpis");
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as OrganizationContractKpiRpcRow[])[0];

  return {
    operatingCount: Number(row?.operating_count ?? 0),
    expiringWithin90DaysCount: Number(row?.expiring_within_90_days_count ?? 0),
    suspendedCount: Number(row?.suspended_count ?? 0),
    terminatedLast12MonthsCount: Number(row?.terminated_last_12_months_count ?? 0),
  };
}

export async function listPlatformHqAccounts(
  opts: PlatformHqAccountQuery = {},
): Promise<{ rows: PlatformHqAccount[]; totalCount: number }> {
  const page = positiveInteger(opts.page, 1);
  const pageSize = Math.min(positiveInteger(opts.pageSize, 10), 100);
  const { data, error } = await createClient().rpc("platform_list_hq_accounts", {
    p_search: opts.search?.trim() || null,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as HqAccountRpcRow[];
  return {
    rows: rows.map((row) => ({
      userId: row.user_id,
      username: row.username,
      fullName: row.full_name,
      phone: row.phone,
      memo: row.memo,
      hqRole: row.hq_role,
      isActive: row.is_active,
      createdAt: row.created_at,
    })),
    totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0,
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
      `활성 메시지 예약 ${formatNumber(Number(result.reserved_points ?? 0))} P를 침범해 조정할 수 없습니다.`,
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
  name: string;
  /** 비우면 서버가 만든다(정본 생성 모달엔 회사코드 칸이 없다). */
  slug?: string;
  phone: string;
  contractStartDate: string;
  contractEndDate: string;
  representativeName: string;
  businessRegistrationNumber: string;
  fax: string;
  email: string;
  address: string;
  region: string;
  operatingHours?: string | null;
  contractFilePaths?: string[];
  /** 정본 신규 테넌트: 관리자 아이디 + 초기 비밀번호(숫자 4자리). 관리자 이름은 서버가 대표자명으로 채운다. */
  owner: { username: string; password: string };
}

export interface CreateOrgResult {
  organization: { id: number; name: string; slug: string | null };
  owner: { username: string };
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

// 수정은 기존 회사코드를 그대로 넘긴다(RPC가 빈 값이면 NULL로 지운다).
export type UpdateOrgInput = Omit<CreateOrgInput, "owner" | "slug"> & { slug: string };

export async function updatePlatformOrganization(id: number, input: UpdateOrgInput): Promise<void> {
  const { error } = await createClient().rpc("platform_update_organization_contract", {
    p_org_id: id,
    p_name: input.name,
    p_slug: input.slug,
    p_phone: input.phone || null,
    p_contract_start_date: input.contractStartDate,
    p_contract_end_date: input.contractEndDate,
    p_representative_name: input.representativeName,
    p_business_registration_number: input.businessRegistrationNumber,
    p_fax: input.fax,
    p_email: input.email,
    p_address: input.address,
    p_region: input.region,
    p_operating_hours: input.operatingHours || null,
    p_contract_file_path: input.contractFilePaths?.[0] ?? null,
    p_contract_file_paths: input.contractFilePaths ?? [],
  });
  if (error) throw new Error(error.message);
}

const ORGANIZATION_CONTRACT_BUCKET = "org-contracts";
export async function uploadOrganizationContractFile(
  file: File,
  organizationId?: number,
): Promise<string> {
  const validationError = validateAttachmentFile(file, "image");
  if (validationError) throw new Error(validationError);

  const safeName = normalizeAttachmentFileName(file.name);
  const path = `${organizationId ?? "pending"}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await createClient().storage
    .from(ORGANIZATION_CONTRACT_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function getOrganizationContractFilePreview(path: string): Promise<string> {
  return createPrivateAssetSignedUrl({
    bucket: ORGANIZATION_CONTRACT_BUCKET,
    path,
    preset: "preview",
    mimeType: imageMimeTypeFromFileName(path),
  });
}

export async function removeOrganizationContractFile(path: string): Promise<void> {
  const { error } = await createClient().storage
    .from(ORGANIZATION_CONTRACT_BUCKET)
    .remove([path]);
  if (error) throw new Error(error.message);
}

export async function setPlatformOrganizationDeleted(id: number, deleted: boolean): Promise<void> {
  const { error } = await createClient()
    .from("organizations")
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export interface DeleteOrgResult {
  /** 로그인 계정까지 지운 직원 수 */
  deletedAccounts: number;
  /** 로그인 계정 삭제에 실패한 직원 수(소속은 이미 제거됨) */
  failedAccounts: number;
}

/** 되돌릴 수 없는 완전 삭제 — 조직과 딸린 데이터·관리자 계정·파일을 모두 지운다(서버 라우트). */
export async function deletePlatformOrganization(id: number): Promise<DeleteOrgResult> {
  const res = await fetch(`/api/platform/organizations/${id}`, { method: "DELETE" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "테넌트 삭제에 실패했습니다.");
  return json as DeleteOrgResult;
}

export interface PlatformOrganizationOwner {
  userId: string;
  username: string | null;
}

/** 테넌트 관리자(org_owner) — 가장 먼저 등록된 소유자. 통합관리자는 org_members·profiles를 직접 읽을 수 있다(0011 정책). */
export async function getPlatformOrganizationOwner(orgId: number): Promise<PlatformOrganizationOwner | null> {
  const client = createClient();
  const { data: member, error } = await client
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "org_owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!member) return null;

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("username")
    .eq("user_id", member.user_id)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  return { userId: member.user_id as string, username: (profile?.username as string | null) ?? null };
}
