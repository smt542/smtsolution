import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "0100_staff_bill_token_mint.sql"), "utf8");

describe("staff_mint_bill_tokens migration", () => {
  it("defines an org- and permission-scoped SECURITY DEFINER RPC", () => {
    expect(sql).toMatch(
      /function public\.staff_mint_bill_tokens\(\s*p_unit_ids bigint\[\],\s*p_period date\s*\)/i,
    );
    expect(sql).toMatch(/returns table\s*\(\s*unit_id bigint,\s*token uuid\s*\)/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/current_user_org\(\)/i);
    expect(sql).toMatch(/current_user_has_module\('bill_publish'\)/i);
  });

  it("only targets confirmed bills in caller-owned buildings and reuses tokens", () => {
    expect(sql).toMatch(/select distinct u\.id as unit_id/i);
    expect(sql).toMatch(/b\.org_id = v_org/i);
    expect(sql).toMatch(/bc\.confirmed_at is not null/i);
    expect(sql).toMatch(/on conflict \(unit_id, period\) do update/i);
    expect(sql).toMatch(/set expires_at = excluded\.expires_at/i);
    expect(sql).toMatch(/returning bill_share_tokens\.unit_id, bill_share_tokens\.token/i);
  });

  it("exposes the RPC only to authenticated callers", () => {
    expect(sql).toMatch(
      /revoke all on function public\.staff_mint_bill_tokens\(bigint\[\], date\) from public, anon/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.staff_mint_bill_tokens\(bigint\[\], date\) to authenticated/i,
    );
  });
});
