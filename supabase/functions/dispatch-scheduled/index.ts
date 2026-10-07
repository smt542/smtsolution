// dispatch-scheduled — 예약 발송 워커(Supabase Edge Function).
//
// pg_cron(0237)이 1분마다 pg_net으로 호출한다. 앱의 /api/messaging/dispatch-scheduled(크론 경로)와
// **같은 코드**(lib/messaging/drainSchedules.ts, orgId=null 전체 조직)를 쓴다.
// 접수만 하고 최종 결과는 delivery-reconcile이 확정한다.
// 배포 전 `node scripts/build-edge-app.mjs`로 _shared/app을 만든다.
// 인증: verify_jwt=false, Authorization: Bearer <Vault delivery_cron_secret>만 허용(_shared/worker.ts).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { drainSchedules } from "../_shared/app/lib/messaging/drainSchedules.ts";
import { authorizeWorker, json } from "../_shared/worker.ts";

Deno.serve(async (req: Request) => {
  const auth = await authorizeWorker(req);
  if ("response" in auth) return auth.response;
  try {
    const result = await drainSchedules({ admin: auth.admin, orgId: null, limit: 50 });
    return json(result);
  } catch (error) {
    console.error("[dispatch-scheduled] failed", (error as Error)?.message);
    return json({ error: "dispatch failed" }, 500);
  }
});
