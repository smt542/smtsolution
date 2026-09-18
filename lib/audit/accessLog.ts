import "server-only";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

export const ACCESS_LOG_EVENTS = [
  "PII_REVEAL",
  "EXPORT_XLSX",
  "EXPORT_CSV",
  "PRINT",
  "SEND_SMS",
  "SEND_ALIMTALK",
  "SEND_FAX",
  "PUBLIC_LINK_VIEW",
] as const;

export type AccessLogEvent = (typeof ACCESS_LOG_EVENTS)[number];

export const ACCESS_LOG_PERSONAS = [
  "manager_staff",
  "field_partner",
  "platform_admin",
  "resident",
  "public",
] as const;

export type AccessLogPersona = (typeof ACCESS_LOG_PERSONAS)[number];

export interface AccessLogParams {
  orgId?: number | null;
  actorId?: string | null;
  actorLabel?: string | null;
  persona?: AccessLogPersona | null;
  event: AccessLogEvent;
  targetKind?: string | null;
  targetId?: string | null;
  field?: string | null;
  rowCount?: number | null;
  detail?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object"
    && error !== null
    && "message" in error
    && typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Unknown error";
}

/**
 * Records one PII access event through service_role.
 *
 * This helper is intentionally fail-open: it never throws and returns false when
 * recording fails. Callers that require fail-closed behavior, including PII_REVEAL
 * callers that must withhold plaintext when logging fails, must inspect the result.
 */
export async function logAccess(params: AccessLogParams): Promise<boolean> {
  try {
    const { error } = await createAdminClient().from("access_log").insert({
      org_id: params.orgId ?? null,
      actor_id: params.actorId ?? null,
      actor_label: params.actorLabel ?? null,
      persona: params.persona ?? null,
      event: params.event,
      target_kind: params.targetKind ?? null,
      target_id: params.targetId ?? null,
      field: params.field ?? null,
      row_count: params.rowCount ?? null,
      detail: params.detail ?? null,
      ip: params.ip ?? null,
      user_agent: params.userAgent ?? null,
    });

    if (error) {
      console.error(params.event, error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error(params.event, getErrorMessage(error));
    return false;
  }
}

/**
 * These proxy headers are spoofable and are recorded for forensics only; they are
 * never used for any authorization decision.
 */
export function extractRequestMeta(req: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")?.trim()
    || null;

  return {
    ip,
    userAgent: req.headers.get("user-agent"),
  };
}

/**
 * Extracts the same request metadata from a Server Component request context.
 * Next.js 16 exposes headers() as an asynchronous API.
 */
export async function extractHeadersMeta(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  try {
    const requestHeaders = await headers();
    const ip =
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
      || requestHeaders.get("x-real-ip")?.trim()
      || null;

    return {
      ip,
      userAgent: requestHeaders.get("user-agent"),
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}
