import type { createAdminClient } from "@/lib/supabase/admin";

// 로그인 무차별 대입(brute-force)·크리덴셜 스터핑 방어용 레이트리미터.
// public.login_rate_limit 테이블 + login_rate_limit_hit() RPC(SECURITY DEFINER)를
// service_role(admin) 클라이언트로만 호출한다. 리미터 장애가 로그인을 막아서는 안 되므로
// 모든 경로는 fail-open(오류 시 허용)으로 설계한다.

type AdminClient = ReturnType<typeof createAdminClient>;

// IP 버킷: 동일 IP에서의 시도. 좁은 창(10분) + 10회면 15분 잠금.
const IP_BUCKET = { max: 10, window: 600, lock: 900 } as const;
// 사용자(아이디) 버킷: 분산 IP에서 한 계정을 노리는 시도. 15분 20회면 15분 잠금.
const USER_BUCKET = { max: 20, window: 900, lock: 900 } as const;

const RPC = "login_rate_limit_hit";

type HitAction = "check" | "fail" | "reset";
type Bucket = { max: number; window: number; lock: number };

export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

type RateKey = { key: string; bucket: Bucket };

function buildKeys({ ip, username }: { ip: string; username?: string }): RateKey[] {
  const keys: RateKey[] = [{ key: `ip:${ip}`, bucket: IP_BUCKET }];
  const normalized = username?.trim().toLowerCase();
  if (normalized) {
    keys.push({ key: `user:${normalized}`, bucket: USER_BUCKET });
  }
  return keys;
}

async function callHit(admin: AdminClient, { key, bucket }: RateKey, action: HitAction) {
  return admin.rpc(RPC, {
    p_key: key,
    p_max_fails: bucket.max,
    p_window_seconds: bucket.window,
    p_lock_seconds: bucket.lock,
    p_action: action,
  });
}

// 사전 점검. 어느 버킷이든 잠겨 있으면 차단하고, 그중 최대 대기시간을 돌려준다.
// 어떤 오류든(예외/ RPC error) fail-open: 로그인을 절대 막지 않는다.
export async function checkLoginRateLimit(
  admin: AdminClient,
  { ip, username }: { ip: string; username?: string },
): Promise<{ allowed: boolean; retryAfter: number }> {
  try {
    let blocked = false;
    let retryAfter = 0;
    for (const rk of buildKeys({ ip, username })) {
      const { data, error } = await callHit(admin, rk, "check");
      if (error) {
        console.error("[loginRateLimit] check rpc error", error);
        return { allowed: true, retryAfter: 0 };
      }
      const row = (data as Array<{ allowed?: boolean; retry_after_seconds?: number }> | null)?.[0];
      if (row && row.allowed === false) {
        blocked = true;
        retryAfter = Math.max(retryAfter, Number(row.retry_after_seconds) || 0);
      }
    }
    if (blocked) return { allowed: false, retryAfter };
    return { allowed: true, retryAfter: 0 };
  } catch (err) {
    console.error("[loginRateLimit] check failed", err);
    return { allowed: true, retryAfter: 0 };
  }
}

// 최종 실패(모든 후보 인증 실패) 시 각 버킷에 실패 1회 기록. 오류는 삼킨다.
export async function recordLoginFailure(
  admin: AdminClient,
  { ip, username }: { ip: string; username?: string },
): Promise<void> {
  try {
    for (const rk of buildKeys({ ip, username })) {
      const { error } = await callHit(admin, rk, "fail");
      if (error) console.error("[loginRateLimit] fail rpc error", error);
    }
  } catch (err) {
    console.error("[loginRateLimit] recordLoginFailure failed", err);
  }
}

// 로그인 성공 시 각 버킷 초기화. 오류는 삼킨다.
export async function recordLoginSuccess(
  admin: AdminClient,
  { ip, username, userId }: { ip: string; username?: string; userId: string },
): Promise<void> {
  try {
    for (const rk of buildKeys({ ip, username })) {
      const { error } = await callHit(admin, rk, "reset");
      if (error) console.error("[loginRateLimit] reset rpc error", error);
    }
  } catch (err) {
    console.error("[loginRateLimit] recordLoginSuccess failed", err);
  }

  try {
    const { error } = await admin.rpc("record_login", {
      p_actor_id: userId,
      p_ip: ip === "unknown" ? null : ip,
    });
    if (error) console.error("[loginRateLimit] login audit rpc error", error);
  } catch (err) {
    console.error("[loginRateLimit] recordLoginAudit failed", err);
  }
}

// 로그인 실패(401) 응답의 타이밍 사이드채널(아이디 존재 여부 유추)을 완화하기 위한 하한 지연.
// GoTrue 자격증명 검증 유무로 생기는 응답시간 차이를 상수 하한으로 평탄화한다.
export async function equalizeLoginTiming(startedAtMs: number, floorMs = 300): Promise<void> {
  const elapsed = Date.now() - startedAtMs;
  if (elapsed < floorMs) {
    await new Promise((resolve) => setTimeout(resolve, floorMs - elapsed));
  }
}
