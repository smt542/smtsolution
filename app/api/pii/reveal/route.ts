import { extractRequestMeta, logAccess } from "@/lib/audit/accessLog";
import { requirePersonaApi, type WorkforcePersona } from "@/lib/api/requirePersona";
import { createClient } from "@/lib/supabase/server";

type RevealTarget = {
  table: string;
  column: string;
  // 테이블마다 기본키가 다르다: 대부분 id bigint, profiles만 user_id uuid.
  idColumn: string;
  idType: "bigint" | "uuid";
  owner:
    | { kind: "column"; column: "org_id" }
    | { kind: "nested"; select: string; path: readonly string[] }
    | { kind: "lookup"; table: "org_members"; lookupColumn: "user_id"; column: "org_id" };
  // 현장 파트너 범위 판정용. RLS는 org 단위라 건물 경계를 막지 못하므로 여기서 건물을
  // 해석해 partner_my_building_ids()와 대조한다. null이면 파트너는 이 대상을 열 수 없다.
  buildingSelect: string | null;
  buildingPath: readonly string[] | null;
};

const DIRECT_ORG = { kind: "column", column: "org_id" } as const;
const OCCUPANCY_ORG = {
  kind: "nested",
  select: "units!inner(building_id,buildings!inner(org_id))",
  path: ["units", "buildings", "org_id"],
} as const;
const OCCUPANCY_BUILDING_PATH = ["units", "building_id"] as const;
const OCCUPANCY_HISTORY_ORG = {
  kind: "nested",
  select: "units!inner(building_id,buildings!inner(org_id))",
  path: ["units", "buildings", "org_id"],
} as const;
const PROFILE_ORG = {
  // profiles and org_members both reference auth.users, but have no direct FK;
  // resolve this ownership path with a second RLS-scoped lookup below.
  kind: "lookup",
  table: "org_members",
  lookupColumn: "user_id",
  column: "org_id",
} as const;
const BUILDING_VENDOR_ORG = {
  kind: "nested",
  select: "buildings!inner(org_id)",
  path: ["buildings", "org_id"],
} as const;

const REVEAL_TARGETS = {
  occupancy: {
    phone: { table: "occupancies", column: "phone", idColumn: "id", idType: "bigint" as const, owner: OCCUPANCY_ORG, buildingSelect: null, buildingPath: OCCUPANCY_BUILDING_PATH },
    phone2: { table: "occupancies", column: "phone2", idColumn: "id", idType: "bigint" as const, owner: OCCUPANCY_ORG, buildingSelect: null, buildingPath: OCCUPANCY_BUILDING_PATH },
    phone3: { table: "occupancies", column: "phone3", idColumn: "id", idType: "bigint" as const, owner: OCCUPANCY_ORG, buildingSelect: null, buildingPath: OCCUPANCY_BUILDING_PATH },
    fax_number: { table: "occupancies", column: "fax_number", idColumn: "id", idType: "bigint" as const, owner: OCCUPANCY_ORG, buildingSelect: null, buildingPath: OCCUPANCY_BUILDING_PATH },
  },
  occupancy_history: {
    phone: { table: "occupancy_history", column: "phone", idColumn: "id", idType: "bigint" as const, owner: OCCUPANCY_HISTORY_ORG, buildingSelect: null, buildingPath: OCCUPANCY_BUILDING_PATH },
    phone2: { table: "occupancy_history", column: "phone2", idColumn: "id", idType: "bigint" as const, owner: OCCUPANCY_HISTORY_ORG, buildingSelect: null, buildingPath: OCCUPANCY_BUILDING_PATH },
    phone3: { table: "occupancy_history", column: "phone3", idColumn: "id", idType: "bigint" as const, owner: OCCUPANCY_HISTORY_ORG, buildingSelect: null, buildingPath: OCCUPANCY_BUILDING_PATH },
  },
  complaint: {
    reporter_phone: { table: "complaints", column: "reporter_phone", idColumn: "id", idType: "bigint" as const, owner: DIRECT_ORG, buildingSelect: "building_id", buildingPath: ["building_id"] },
  },
  building: {
    owner_phone: { table: "buildings", column: "owner_phone", idColumn: "id", idType: "bigint" as const, owner: DIRECT_ORG, buildingSelect: "id", buildingPath: ["id"] },
  },
  vendor: {
    // 거래처는 org 자산이라 건물에 매이지 않는다. 파트너 화면에서 쓰지 않으므로 파트너는 열 수 없다.
    phone: { table: "vendors", column: "phone", idColumn: "id", idType: "bigint" as const, owner: DIRECT_ORG, buildingSelect: null, buildingPath: null },
  },
  building_vendor: {
    phone: {
      table: "building_vendors",
      column: "phone",
      idColumn: "id",
      idType: "bigint" as const,
      owner: BUILDING_VENDOR_ORG,
      buildingSelect: "building_id",
      buildingPath: ["building_id"],
    },
  },
  profile: {
    // 직원 프로필도 건물 소속이 아니다. 파트너는 열 수 없다.
    phone: { table: "profiles", column: "phone", idColumn: "user_id", idType: "uuid" as const, owner: PROFILE_ORG, buildingSelect: null, buildingPath: null },
  },
} as const satisfies Record<string, Record<string, RevealTarget>>;

const REVEAL_PERSONAS = [
  "manager_staff",
  "field_partner",
  "platform_admin",
] as const satisfies readonly WorkforcePersona[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveRevealTarget(targetKind: string, field: string): RevealTarget | null {
  if (!Object.hasOwn(REVEAL_TARGETS, targetKind)) return null;

  const fields = REVEAL_TARGETS[targetKind as keyof typeof REVEAL_TARGETS];
  if (!Object.hasOwn(fields, field)) return null;

  return fields[field as keyof typeof fields];
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function normalizeTargetId(
  value: unknown,
  idType: RevealTarget["idType"],
): string | null {
  if (idType === "uuid") {
    if (typeof value !== "string") return null;
    const uuid = value.trim().toLowerCase();
    return UUID_PATTERN.test(uuid) ? uuid : null;
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) return null;
    return String(value);
  }

  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^[1-9]\d*$/.test(normalized) ? normalized : null;
}

function normalizePositiveId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^[1-9]\d*$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function getNestedValue(row: Record<string, unknown>, path: readonly string[]): unknown {
  let current: unknown = row;
  for (const segment of path) {
    if (!isRecord(current)) return null;
    current = current[segment];
    if (Array.isArray(current)) current = current[0] ?? null;
  }
  return current;
}

function revealSelect(target: RevealTarget): string {
  if (target.owner.kind === "lookup") return target.column;
  const owner = target.owner.kind === "column" ? target.owner.column : target.owner.select;
  // buildingSelect가 null인 대상은 owner select 안에 building_id가 이미 들어 있거나
  // (occupancy 계열) 건물에 매이지 않는 대상이다.
  return [target.column, owner, target.buildingSelect].filter(Boolean).join(",");
}

async function authorizeReveal(sb: Awaited<ReturnType<typeof createClient>>): Promise<
  | { ok: true; persona: WorkforcePersona; orgId: number | null; actorId: string | null }
  | { ok: false; response: Response }
> {
  for (const persona of REVEAL_PERSONAS) {
    const gate = await requirePersonaApi(sb, persona);
    if (gate.ok) {
      const orgId = typeof gate.ctx.org_id === "number" && Number.isSafeInteger(gate.ctx.org_id)
        ? gate.ctx.org_id
        : null;
      return { ok: true, persona, orgId, actorId: gate.userId };
    }

    if (gate.response.status === 401) return { ok: false, response: gate.response };
  }

  return { ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) };
}

export async function POST(request: Request) {
  const sb = await createClient();
  const authorization = await authorizeReveal(sb);
  if (!authorization.ok) return authorization.response;

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return Response.json({ error: "Invalid reveal request" }, { status: 400 });
  }

  const { targetKind, targetId: rawTargetId, field } = body;
  if (typeof targetKind !== "string" || typeof field !== "string") {
    return Response.json({ error: "Invalid reveal request" }, { status: 400 });
  }

  const target = resolveRevealTarget(targetKind, field);
  if (!target) {
    return Response.json({ error: "Invalid reveal request" }, { status: 400 });
  }

  const targetId = normalizeTargetId(rawTargetId, target.idType);
  if (!targetId) {
    return Response.json({ error: "Invalid reveal request" }, { status: 400 });
  }

  // This query deliberately uses the RLS-scoped session client. RLS is the
  // authority that prevents a field partner from crossing building boundaries.
  const { data, error } = await sb
    .from(target.table)
    .select(revealSelect(target))
    .eq(target.idColumn, targetId)
    .maybeSingle();

  if (error) {
    console.error("PII reveal lookup failed", error.message);
    return Response.json({ error: "Unable to reveal this field" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "Record not found" }, { status: 404 });

  const value = (data as unknown as Record<string, unknown>)[target.column];
  if (value !== null && typeof value !== "string") {
    console.error("PII reveal returned an unexpected value type");
    return Response.json({ error: "Unable to reveal this field" }, { status: 500 });
  }

  const row = data as unknown as Record<string, unknown>;
  let ownerOrgId: number | null = null;
  if (target.owner.kind === "column") {
    ownerOrgId = normalizePositiveId(row[target.owner.column]);
  } else if (target.owner.kind === "nested") {
    ownerOrgId = normalizePositiveId(getNestedValue(row, target.owner.path));
  } else {
    const { data: member, error: memberError } = await sb
      .from(target.owner.table)
      .select(target.owner.column)
      .eq(target.owner.lookupColumn, targetId)
      .order(target.owner.column)
      .limit(1)
      .maybeSingle();

    if (memberError) {
      console.error("PII reveal owner lookup failed", memberError.message);
      return Response.json({ error: "Unable to reveal this field" }, { status: 500 });
    }

    ownerOrgId = isRecord(member) ? normalizePositiveId(member[target.owner.column]) : null;
    if (ownerOrgId === null) {
      // profiles can outlive org_members after membership removal, so no owning
      // org exists in that state; retain the actor's org as the only audit scope.
      ownerOrgId = authorization.orgId;
    }
  }

  if (ownerOrgId === null) {
    console.error("PII reveal owner organization could not be resolved");
    return Response.json({ error: "Unable to complete reveal" }, { status: 503 });
  }

  // 현장 파트너는 담당 건물 밖을 열 수 없다. occupancies 등의 RLS는 org 단위라
  // 이 경계를 막지 못하므로(파트너도 org 구성원이다) 여기서 건물을 대조한다.
  // 존재 여부가 새지 않도록 범위를 벗어나면 404로 응답한다.
  if (authorization.persona === "field_partner") {
    if (!target.buildingPath) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }

    const buildingId = normalizePositiveId(getNestedValue(row, target.buildingPath));
    if (buildingId === null) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }

    const { data: scope, error: scopeError } = await sb.rpc("partner_my_building_ids");
    if (scopeError) {
      console.error("PII reveal partner scope lookup failed", scopeError.message);
      return Response.json({ error: "Unable to reveal this field" }, { status: 500 });
    }

    const scopedIds = Array.isArray(scope) ? scope : [];
    const inScope = scopedIds.some((entry) => {
      const value = isRecord(entry) ? entry.partner_my_building_ids : entry;
      return normalizePositiveId(value) === buildingId;
    });
    if (!inScope) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }
  }

  const { ip, userAgent } = extractRequestMeta(request);
  const auditRecorded = await logAccess({
    event: "PII_REVEAL",
    persona: authorization.persona,
    orgId: ownerOrgId,
    actorId: authorization.actorId,
    targetKind,
    targetId,
    field,
    ip,
    userAgent,
  });
  if (!auditRecorded) {
    // Never return plaintext unless the audit row was recorded successfully.
    return Response.json({ error: "Unable to complete reveal" }, { status: 503 });
  }

  return Response.json({ value });
}
