import { createClient } from "@/lib/supabase/client";

export type ResidentClaimStatus = "pending" | "linked" | "rejected";
export type ResidentClaimKind = "auto" | "manual" | "search";

export interface ResidentStubLoginInput {
  kakaoId?: string;
  name?: string;
  phone?: string;
}

export interface ResidentStubLoginResult {
  userId: string;
  kakaoId: string;
  name: string;
  phone: string;
}

export interface ResidentAutomatchCandidate {
  orgId: number;
  buildingId: number;
  buildingName: string;
  unitId: number;
  unitNo: string;
  occupancyId: number;
}

export interface ResidentLink {
  claimId: number;
  orgId: number;
  buildingId: number | null;
  buildingName: string | null;
  unitId: number | null;
  unitNo: string | null;
  occupancyId: number | null;
  tenantName: string | null;
  occupancyPhone: string | null;
  linkedAt: string;
}

export interface ResidentClaim {
  claimId: number;
  orgId: number | null;
  residentUserId: string;
  kakaoId: string | null;
  kakaoName: string | null;
  residentPhone: string | null;
  claimedName: string | null;
  claimedPhone: string | null;
  buildingId: number | null;
  buildingName: string | null;
  unitId: number | null;
  unitNo: string | null;
  claimedUnitText: string | null;
  occupancyId: number | null;
  occupancyTenantName: string | null;
  occupancyPhone: string | null;
  status: ResidentClaimStatus;
  kind: ResidentClaimKind;
  memo: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

type AutomatchRow = {
  org_id: number;
  building_id: number;
  building_name: string;
  unit_id: number;
  unit_no: string;
  occupancy_id: number;
};

type ResidentLinkRow = {
  claim_id: number;
  org_id: number;
  building_id: number | null;
  building_name: string | null;
  unit_id: number | null;
  unit_no: string | null;
  occupancy_id: number | null;
  tenant_name: string | null;
  occupancy_phone: string | null;
  linked_at: string;
};

type ResidentClaimRow = {
  claim_id: number;
  org_id: number | null;
  resident_user_id: string;
  kakao_id: string | null;
  kakao_name: string | null;
  resident_phone: string | null;
  claimed_name: string | null;
  claimed_phone: string | null;
  building_id: number | null;
  building_name: string | null;
  unit_id: number | null;
  unit_no: string | null;
  claimed_unit_text: string | null;
  occupancy_id: number | null;
  occupancy_tenant_name: string | null;
  occupancy_phone: string | null;
  status: ResidentClaimStatus;
  kind: ResidentClaimKind;
  memo: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

const rowToAutomatch = (row: AutomatchRow): ResidentAutomatchCandidate => ({
  orgId: row.org_id,
  buildingId: row.building_id,
  buildingName: row.building_name,
  unitId: row.unit_id,
  unitNo: row.unit_no,
  occupancyId: row.occupancy_id,
});

const rowToResidentLink = (row: ResidentLinkRow): ResidentLink => ({
  claimId: row.claim_id,
  orgId: row.org_id,
  buildingId: row.building_id,
  buildingName: row.building_name,
  unitId: row.unit_id,
  unitNo: row.unit_no,
  occupancyId: row.occupancy_id,
  tenantName: row.tenant_name,
  occupancyPhone: row.occupancy_phone,
  linkedAt: row.linked_at,
});

const rowToResidentClaim = (row: ResidentClaimRow): ResidentClaim => ({
  claimId: row.claim_id,
  orgId: row.org_id,
  residentUserId: row.resident_user_id,
  kakaoId: row.kakao_id,
  kakaoName: row.kakao_name,
  residentPhone: row.resident_phone,
  claimedName: row.claimed_name,
  claimedPhone: row.claimed_phone,
  buildingId: row.building_id,
  buildingName: row.building_name,
  unitId: row.unit_id,
  unitNo: row.unit_no,
  claimedUnitText: row.claimed_unit_text,
  occupancyId: row.occupancy_id,
  occupancyTenantName: row.occupancy_tenant_name,
  occupancyPhone: row.occupancy_phone,
  status: row.status,
  kind: row.kind,
  memo: row.memo,
  createdAt: row.created_at,
  resolvedAt: row.resolved_at,
  resolvedBy: row.resolved_by,
});

export async function stubResidentKakaoLogin(
  input: ResidentStubLoginInput = {},
): Promise<ResidentStubLoginResult> {
  const response = await fetch("/api/resident/kakao/stub", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error ?? "Resident stub login failed.");
  return json as ResidentStubLoginResult;
}

export async function residentAutomatch(): Promise<ResidentAutomatchCandidate[]> {
  const { data, error } = await createClient().rpc("resident_automatch");
  if (error) throw new Error(error.message);
  return ((data ?? []) as AutomatchRow[]).map(rowToAutomatch);
}

export async function residentConfirm(occupancyId: number): Promise<void> {
  const { error } = await createClient().rpc("resident_confirm", {
    p_occupancy_id: occupancyId,
  });
  if (error) throw new Error(error.message);
}

export async function residentRequestClaim(input: {
  buildingId: number;
  unitText: string;
}): Promise<void> {
  const { error } = await createClient().rpc("resident_request_claim", {
    p_building_id: input.buildingId,
    p_unit_text: input.unitText,
  });
  if (error) throw new Error(error.message);
}

export async function residentMyLink(): Promise<ResidentLink | null> {
  const { data, error } = await createClient().rpc("resident_my_link");
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as ResidentLinkRow[])[0];
  return row ? rowToResidentLink(row) : null;
}

export async function listResidentClaims(
  status?: ResidentClaimStatus,
): Promise<ResidentClaim[]> {
  const { data, error } = await createClient().rpc("list_res_claims", {
    p_status: status ?? null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ResidentClaimRow[]).map(rowToResidentClaim);
}

export async function approveResidentClaim(input: {
  claimId: number;
  occupancyId: number;
}): Promise<void> {
  const { error } = await createClient().rpc("approve_res_claim", {
    p_claim_id: input.claimId,
    p_occupancy_id: input.occupancyId,
  });
  if (error) throw new Error(error.message);
}

export async function rejectResidentClaim(claimId: number): Promise<void> {
  const { error } = await createClient().rpc("reject_res_claim", {
    p_claim_id: claimId,
  });
  if (error) throw new Error(error.message);
}
