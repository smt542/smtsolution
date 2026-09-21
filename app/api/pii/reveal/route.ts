import { extractRequestMeta } from "@/lib/audit/accessLog";
import { createClient } from "@/lib/supabase/server";

/**
 * 열람 가능한 (대상, 필드) 목록과 기본키 타입. 이 표는 요청을 DB에 보내기 전에 1차로
 * 거르기 위한 것이고, **실제 권위는 마이그 0185 의 `reveal_pii_fields`** 다 — 테이블·컬럼
 * 매핑과 org/건물 경계 판정은 전부 거기 있다(그쪽도 같은 화이트리스트를 다시 검사한다).
 * 어느 한쪽만 고치면 다른 쪽에서 막히므로 둘을 함께 고쳐야 한다.
 */
type RevealTarget = {
  // 테이블마다 기본키가 다르다: 대부분 id bigint, profiles만 user_id uuid.
  idType: "bigint" | "uuid";
};

const BIGINT_KEY = { idType: "bigint" } as const;
const UUID_KEY = { idType: "uuid" } as const;

const REVEAL_TARGETS = {
  occupancy: {
    phone: BIGINT_KEY,
    phone2: BIGINT_KEY,
    phone3: BIGINT_KEY,
    fax_number: BIGINT_KEY,
  },
  occupancy_history: {
    phone: BIGINT_KEY,
    phone2: BIGINT_KEY,
    phone3: BIGINT_KEY,
  },
  complaint: {
    reporter_phone: BIGINT_KEY,
  },
  building: {
    owner_phone: BIGINT_KEY,
  },
  vendor: {
    // 거래처는 org 자산이라 건물에 매이지 않는다. 파트너 화면에서 쓰지 않으므로 파트너는 열 수 없다.
    phone: BIGINT_KEY,
  },
  building_vendor: {
    phone: BIGINT_KEY,
  },
  profile: {
    // 직원 프로필도 건물 소속이 아니다. 파트너는 열 수 없다.
    phone: UUID_KEY,
    // 직원 계정 편집 폼이 저장 전에 원문을 받아야 하는 보조 번호(1ec1516f).
    phone_sub: UUID_KEY,
  },
} as const satisfies Record<string, Record<string, RevealTarget>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveRevealTarget(targetKind: string, field: string): RevealTarget | null {
  if (!Object.hasOwn(REVEAL_TARGETS, targetKind)) return null;

  const fields = REVEAL_TARGETS[targetKind as keyof typeof REVEAL_TARGETS];
  if (!Object.hasOwn(fields, field)) return null;

  return fields[field as keyof typeof fields];
}

/** 한 레코드에서 한 번에 열람할 수 있는 필드 수 상한. 편집 폼이 쓰는 번호 필드는 최대 4개다. */
const MAX_REVEAL_FIELDS = 8;

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

type RevealResult = {
  status: string;
  values?: Record<string, unknown>;
};

function isRevealResult(value: unknown): value is RevealResult {
  if (!isRecord(value) || typeof value.status !== "string") return false;
  return value.values === undefined || isRecord(value.values);
}

export async function POST(request: Request) {
  const sb = await createClient();

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return Response.json({ error: "Invalid reveal request" }, { status: 400 });
  }

  // 편집 폼은 한 레코드의 번호 필드를 한꺼번에 받아야 한다(목록이 마스킹돼도 폼에는 원문이
  // 들어가야 마스킹 값이 저장되지 않는다). 그래서 fields 배열을 받되, 기존 단건 호출
  // (field 문자열)도 그대로 지원한다.
  const { targetKind, targetId: rawTargetId } = body;
  const isBatch = Array.isArray(body.fields);
  const requestedFields = isBatch
    ? (body.fields as unknown[])
    : typeof body.field === "string"
      ? [body.field]
      : null;

  if (
    typeof targetKind !== "string"
    || requestedFields === null
    || requestedFields.length === 0
    || requestedFields.length > MAX_REVEAL_FIELDS
    || !requestedFields.every((entry): entry is string => typeof entry === "string")
  ) {
    return Response.json({ error: "Invalid reveal request" }, { status: 400 });
  }

  const fields = [...new Set(requestedFields)];
  const targets = fields.map((field) => resolveRevealTarget(targetKind, field));
  if (targets.some((target) => target === null)) {
    return Response.json({ error: "Invalid reveal request" }, { status: 400 });
  }

  const targetId = normalizeTargetId(rawTargetId, targets[0]!.idType);
  if (!targetId) {
    return Response.json({ error: "Invalid reveal request" }, { status: 400 });
  }

  // persona 게이트·레코드 읽기·감사로그를 이 한 번의 왕복에서 끝낸다(마이그 0185·0186).
  // 인가 판정을 TS 로 옮겨 적지 않는 이유는 규칙이 두 곳으로 갈라지면 구멍이 나기 때문이다 —
  // 함수 안에서 current_user_is_* 프레디킷이 그대로 유일한 기준으로 남는다.
  // 함수는 security invoker 라 읽기가 호출자 권한으로 돌고, 따라서 RLS 가 그대로 경계를
  // 지킨다. 기록이 실패하면 함수째로 롤백돼 원문이 나가지 않는다.
  const { ip, userAgent } = extractRequestMeta(request);
  const { data, error } = await sb.rpc("reveal_pii_fields", {
    p_target_kind: targetKind,
    p_target_id: targetId,
    p_fields: fields,
    p_ip: ip,
    p_user_agent: userAgent,
  });

  if (error) {
    // 세션이 없으면 authenticated 전용 함수라 PostgREST 가 권한에서 막는다 → 401.
    if (/permission denied/i.test(error.message)) {
      return Response.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    console.error("PII reveal failed", error.message);
    return Response.json({ error: "Unable to reveal this field" }, { status: 500 });
  }
  if (!isRevealResult(data)) {
    console.error("PII reveal returned an unexpected payload");
    return Response.json({ error: "Unable to reveal this field" }, { status: 500 });
  }
  // 직원·파트너·플랫폼관리자가 아니면 403(예: 세입자 세션).
  if (data.status === "forbidden") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  // 행이 없을 때와 파트너 담당 건물 밖일 때를 구분하지 않는다 — 존재 여부가 새지 않도록.
  if (data.status !== "ok" || !data.values) {
    return Response.json({ error: "Record not found" }, { status: 404 });
  }

  const values: Record<string, string | null> = {};
  for (const field of fields) {
    const value = data.values[field];
    if (value !== null && value !== undefined && typeof value !== "string") {
      console.error("PII reveal returned an unexpected value type");
      return Response.json({ error: "Unable to reveal this field" }, { status: 500 });
    }
    values[field] = (value as string | null | undefined) ?? null;
  }

  // 기존 단건 호출(MaskedPhone 등)의 응답 형태는 바꾸지 않는다.
  return Response.json(isBatch ? { values } : { value: values[fields[0]] });
}
