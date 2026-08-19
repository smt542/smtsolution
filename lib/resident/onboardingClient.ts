export type KakaoIdentity = {
  kakaoId: string;
  name: string;
  phone: string;
  kakaoName?: string;
};

export type Candidate = {
  occupancyId: string;
  buildingId: string;
  buildingName: string;
  unitNo: string;
  orgId: string;
  orgName: string;
  tenantName: string;
  tenantNameMasked: string;
  phoneMasked: string;
  moveInDate: string;
};

export type Building = {
  id: string;
  name: string;
  address: string;
};

export type ClaimKind = "unit" | "search";

export type MyLink = {
  buildingName: string;
  unitNo: string;
  tenantName: string;
};

export type PendingInfo = {
  buildingName: string;
  unitNo: string;
  requestedAt: string;
  orgName: string;
  orgPhone: string;
};

export const DEMO_MATCHED_IDENTITY: KakaoIdentity = {
  kakaoId: "kko_match_7788",
  name: "박정호",
  phone: "010-2000-7788",
  kakaoName: "박정호",
};

export const DEMO_UNMATCHED_IDENTITY: KakaoIdentity = {
  kakaoId: "kko_new_0001",
  name: "김세입",
  phone: "010-8842-1150",
};

const BUILDINGS: Building[] = [
  {
    id: "bld_greenvilla",
    name: "그린빌라",
    address: "대전 유성구 봉명동 123-4",
  },
  { id: "bld_1", name: "중앙타워", address: "대전 서구 둔산동 55-1" },
  { id: "bld_2", name: "라온아파트", address: "대전 중구 대흥동 200" },
  {
    id: "bld_3",
    name: "햇살하이츠",
    address: "대전 유성구 봉명동 987-65",
  },
  { id: "bld_4", name: "새봄하우스", address: "대전 중구 괴정동 77-2" },
  { id: "bld_5", name: "봄내스퀘어", address: "대전 유성구 노은동 44-2" },
  { id: "bld_6", name: "하나로타워", address: "대전 서구 갈마동 812" },
  { id: "bld_7", name: "해든하우스", address: "대전 대덕구 오정동 55" },
  { id: "bld_8", name: "미래스퀘어", address: "대전 서구 둔산동 1102" },
  { id: "bld_9", name: "정든빌라", address: "대전 중구 태평동 77-9" },
  { id: "bld_10", name: "수정하이츠", address: "대전 유성구 지족동 210" },
  { id: "bld_11", name: "청솔아파트", address: "대전 서구 월평동 305" },
  {
    id: "bld_12",
    name: "다온레지던스",
    address: "대전 유성구 봉명동 501",
  },
  { id: "bld_13", name: "세종스테이", address: "세종 나성동 12-3" },
  { id: "bld_14", name: "온샘빌라", address: "대전 대덕구 법동 88-1" },
  { id: "bld_15", name: "루미에르타워", address: "대전 서구 만년동 21" },
  { id: "bld_16", name: "가온아파트", address: "대전 중구 문화동 402" },
  { id: "bld_17", name: "별하우스", address: "대전 유성구 관평동 77" },
];

const MATCHED_CANDIDATE: Candidate = {
  occupancyId: "occ_greenvilla_201",
  buildingId: "bld_greenvilla",
  buildingName: "그린빌라",
  unitNo: "201호",
  orgId: "org_smile",
  orgName: "스마일종합관리",
  tenantName: "박정호",
  tenantNameMasked: "박O호",
  phoneMasked: "010-****-7788",
  moveInDate: "2024.03.02",
};

const MATCHED_ORG_PHONE = "042-822-4410";

let session: { identity: KakaoIdentity } | null = null;
let linkedHousehold: MyLink | null = null;
let pendingInfo: PendingInfo | null = null;
let activeCandidate: Candidate | null = null;

export async function kakaoStubLogin(
  input: Partial<KakaoIdentity> = {},
): Promise<{ ok: true }> {
  session = {
    identity: {
      ...DEMO_MATCHED_IDENTITY,
      ...input,
    },
  };
  linkedHousehold = null;
  pendingInfo = null;
  activeCandidate = null;

  return { ok: true };
}

export async function automatch(): Promise<Candidate[]> {
  const identity = session?.identity;
  const isMatched =
    identity?.kakaoId === DEMO_MATCHED_IDENTITY.kakaoId ||
    identity?.phone === DEMO_MATCHED_IDENTITY.phone;

  activeCandidate = isMatched ? MATCHED_CANDIDATE : null;
  return activeCandidate ? [activeCandidate] : [];
}

export async function confirm(
  occupancyId: string,
): Promise<{ status: "linked" }> {
  if (!session) {
    throw new Error("A resident session is required to confirm an occupancy.");
  }

  const candidate =
    activeCandidate?.occupancyId === occupancyId
      ? activeCandidate
      : occupancyId === MATCHED_CANDIDATE.occupancyId
        ? MATCHED_CANDIDATE
        : null;

  if (!candidate) {
    throw new Error("The requested occupancy is not available for confirmation.");
  }

  linkedHousehold = {
    buildingName: candidate.buildingName,
    unitNo: candidate.unitNo,
    tenantName: candidate.tenantName,
  };
  pendingInfo = null;

  return { status: "linked" };
}

export async function requestClaim(input: {
  buildingId?: string;
  unitText?: string;
  kind: ClaimKind;
}): Promise<{ status: "pending" }> {
  if (!session) {
    throw new Error("A resident session is required to request a claim.");
  }

  const buildingName =
    input.kind === "unit"
      ? (BUILDINGS.find((building) => building.id === input.buildingId)?.name ?? "")
      : "";
  const unitDigits = input.unitText?.replace(/[^0-9]/g, "") ?? "";
  const unitNo = input.kind === "unit" && unitDigits ? `${unitDigits}호` : "";

  pendingInfo = {
    buildingName,
    unitNo,
    requestedAt: new Date().toISOString(),
    orgName: MATCHED_CANDIDATE.orgName,
    orgPhone: MATCHED_ORG_PHONE,
  };

  return { status: "pending" };
}

export async function myLink(): Promise<MyLink | null> {
  return linkedHousehold;
}

// Mock-only support helpers. Revisit each helper when swapping in the O1 client.
export async function searchBuildings(query: string): Promise<Building[]> {
  const normalizedQuery = query.trim().toLowerCase();
  const matches = normalizedQuery
    ? BUILDINGS.filter((building) =>
        `${building.name} ${building.address}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : BUILDINGS;

  return matches.map((building) => ({ ...building }));
}

export function getSession(): { identity: KakaoIdentity } | null {
  return session;
}

export function getActiveCandidate(): Candidate | null {
  return activeCandidate;
}

export function getPendingInfo(): PendingInfo | null {
  return pendingInfo;
}

export async function approveMockPending(): Promise<{ status: "linked" }> {
  if (!session || !pendingInfo) {
    throw new Error("A resident session and pending claim are required for approval.");
  }

  linkedHousehold = {
    buildingName: pendingInfo.buildingName,
    unitNo: pendingInfo.unitNo,
    tenantName: session.identity.name,
  };
  pendingInfo = null;

  return { status: "linked" };
}

export function logout(): void {
  session = null;
  linkedHousehold = null;
  pendingInfo = null;
  activeCandidate = null;
}
