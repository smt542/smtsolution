import { createClient } from "@/lib/supabase/server";

import { AsList, type AsRow } from "./AsList";

export const dynamic = "force-dynamic";

// partner_list_complaints는 한 번에 최대 100건(인자 없이 부르면 40건)만 준다.
// 홈은 받은 목록 전체를 화면에서 거르고 정렬하므로 최신순 커서로 끝까지 읽는다.
const PAGE_SIZE = 100;

export default async function PartnerHomePage() {
  const supabase = await createClient();
  const rows: AsRow[] = [];
  for (;;) {
    const last = rows.length > 0 ? rows[rows.length - 1] : null;
    const { data } = await supabase.rpc("partner_list_complaints", {
      p_limit: PAGE_SIZE,
      p_before_received_at: last?.received_at ?? null,
      p_before_id: last?.id ?? null,
    });
    const page = (Array.isArray(data) ? data : []) as AsRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return <AsList rows={rows} />;
}
