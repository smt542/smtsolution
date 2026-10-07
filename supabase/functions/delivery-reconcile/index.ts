// delivery-reconcile — 팝빌 발송 결과 재조회 워커(Supabase Edge Function).
//
// pg_cron(0237)이 1분마다 pg_net으로 호출한다. 앱의 /api/delivery/reconcile과 **같은 코드**
// (lib/messaging/reconcile.ts)를 쓴다. 배포 전 `node scripts/build-edge-app.mjs`로 _shared/app을 만든다.
// 인증: verify_jwt=false, Authorization: Bearer <Vault delivery_cron_secret>만 허용(_shared/worker.ts).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { reconcilePendingDeliveries } from "../_shared/app/lib/messaging/reconcile.ts";
import { authorizeWorker, json } from "../_shared/worker.ts";

Deno.serve(async (req: Request) => {
  const auth = await authorizeWorker(req);
  if ("response" in auth) return auth.response;
  try {
    const result = await reconcilePendingDeliveries({ admin: auth.admin, limit: 100 });
    return json(result);
  } catch (error) {
    console.error("[delivery-reconcile] failed", (error as Error)?.message);
    return json({ error: "reconcile failed" }, 500);
  }
});
