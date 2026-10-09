// Resident onboarding client — thin facade over the real O1 resident hooks
// (hooks/reactquery/residentClaims/apis.ts). Screens import ONLY from here so the
// data layer stays swappable. This layer also keeps the small amount of transient
// client-side state O1 does not expose to residents (the Kakao identity from stub
// login, the cached automatch candidate, and the just-submitted claim shown on the
// pending screen).
//
// HYBRID scope note: the verify card fields (masked name / phone / move-in date /
// management org) are now returned by resident_automatch (migration 0140). Org
// contact on the pending screen remains an O1-extension backlog. See
// [[resident-onboarding-status]].

import { createClient } from "@/lib/supabase/client";
import {
  residentAutomatch,
  residentConfirm,
  residentMyLink,
  residentPendingState,
  residentRequestClaim,
  residentSearchBuildings,
  stubResidentKakaoLogin,
} from "@/hooks/reactquery/residentClaims";

export type KakaoIdentity = {
  kakaoId: string;
  name: string;
  phone: string | null;
};

// Trimmed to what O1 `resident_automatch` actually returns (building + unit + ids).
export type Candidate = {
  occupancyId: number;
  buildingId: number;
  buildingName: string;
  unitNo: string;
  orgId: number;
  kakaoName: string | null;
  tenantNameMasked: string | null;
  phoneMasked: string | null;
  moveInDate: string | null;
  orgName: string | null;
  profileImageUrl: string | null;
};

export type Building = {
  id: number;
  name: string;
  address: string;
};

export type MyLink = {
  buildingName: string;
  unitNo: string;
  tenantName: string;
};

// Sourced from the just-submitted claim (O1 has no resident-facing "my pending
// claim" query, and request_claim returns void). No org contact — backlog.
export type PendingInfo = {
  buildingName: string;
  unitNo: string;
  requestedAt: string;
};

let identity: KakaoIdentity | null = null;
let activeCandidate: Candidate | null = null;
let pending: PendingInfo | null = null;

export function resetOnboardingSession(): void {
  identity = null;
  activeCandidate = null;
  pending = null;
}

// real: POST /api/resident/kakao/stub (replace with real Kakao OAuth later)
export async function kakaoStubLogin(
  input: Partial<KakaoIdentity> = {},
): Promise<{ ok: true }> {
  const result = await stubResidentKakaoLogin({
    kakaoId: input.kakaoId,
    name: input.name,
    phone: input.phone ?? undefined,
  });

  identity = {
    kakaoId: result.kakaoId,
    name: result.name,
    phone: result.phone,
  };
  activeCandidate = null;
  pending = null;

  return { ok: true };
}

// real: rpc resident_automatch
export async function automatch(): Promise<Candidate[]> {
  const candidates = (await residentAutomatch()).map((row) => ({
    occupancyId: row.occupancyId,
    buildingId: row.buildingId,
    buildingName: row.buildingName,
    unitNo: row.unitNo,
    orgId: row.orgId,
    kakaoName: row.kakaoName,
    tenantNameMasked: row.tenantNameMasked,
    phoneMasked: row.phoneMasked,
    moveInDate: row.moveInDate,
    orgName: row.orgName,
    profileImageUrl: row.profileImageUrl,
  }));

  activeCandidate = candidates[0] ?? null;
  return candidates;
}

export function getActiveCandidate(): Candidate | null {
  return activeCandidate;
}

// real: rpc resident_confirm
export async function confirm(
  occupancyId: number,
): Promise<{ status: "linked" }> {
  await residentConfirm(occupancyId);
  pending = null;
  return { status: "linked" };
}

// real: rpc resident_request_claim (building_id is required; buildingName is kept
// only for the local pending display).
export async function requestClaim(input: {
  buildingId: number;
  unitText: string;
  buildingName: string;
}): Promise<{ status: "pending" }> {
  await residentRequestClaim({
    buildingId: input.buildingId,
    unitText: input.unitText,
  });

  const digits = input.unitText.replace(/[^0-9]/g, "");
  pending = {
    buildingName: input.buildingName,
    unitNo: digits ? `${digits}호` : input.unitText,
    requestedAt: new Date().toISOString(),
  };

  return { status: "pending" };
}

// real: rpc resident_my_link
export async function myLink(): Promise<MyLink | null> {
  const link = await residentMyLink();
  if (!link) return null;

  return {
    buildingName: link.buildingName ?? "",
    unitNo: link.unitNo ?? "",
    tenantName: link.tenantName ?? "",
  };
}

export async function pendingState(): Promise<PendingInfo | null> {
  const state = await residentPendingState();
  if (!state) return null;
  return {
    buildingName: state.buildingName,
    unitNo: state.unitNo,
    requestedAt: state.requestedAt,
  };
}

// real: rpc resident_search_buildings
export async function searchBuildings(query: string): Promise<Building[]> {
  const rows = await residentSearchBuildings(query.trim() || undefined);
  return rows.map((row) => ({
    id: row.buildingId,
    name: row.name,
    address: row.address ?? "",
  }));
}

// Client-side session flag from the current run's stub login. Screens guard on this
// synchronously. NOTE: a hard refresh clears it (onboarding restarts) even though the
// Supabase cookie may still be valid — acceptable for the stub phase; revisit with
// real Kakao OAuth.
export function getSession(): { identity: KakaoIdentity } | null {
  return identity ? { identity } : null;
}

// A real OAuth callback performs a full-page navigation, so module state is
// empty on arrival. Rehydrate the identity from the authenticated Supabase
// session while keeping the synchronous stub path available for local tests.
export async function loadSession(): Promise<{ identity: KakaoIdentity } | null> {
  const current = getSession();
  if (current) return current;

  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: residentIdentity, error: identityError } = await supabase
    .from("resident_identities")
    .select("kakao_id,kakao_name,phone")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (identityError || !residentIdentity) return null;

  identity = {
    kakaoId: residentIdentity.kakao_id,
    name: residentIdentity.kakao_name ?? "",
    phone: residentIdentity.phone,
  };
  return { identity };
}

export function getPendingInfo(): PendingInfo | null {
  return pending;
}

export async function logout(): Promise<void> {
  resetOnboardingSession();
  try {
    await createClient().auth.signOut({ scope: "local" });
  } catch {
    // best-effort sign-out; client state is already cleared
  }
}
