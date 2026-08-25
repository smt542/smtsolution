import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(here, "0101_notice_settlement_share_tokens.sql"),
  "utf8",
);

function functionBody(name: string, nextMarker: string): string {
  const start = sql.indexOf(`create or replace function public.${name}`);
  const end = sql.indexOf(nextMarker, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

describe("notice and settlement share-token migration", () => {
  it("creates RPC-only token tables with one reusable token per record", () => {
    expect(sql).toMatch(/create table public\.notice_share_tokens/i);
    expect(sql).toMatch(/unique \(notice_id\)/i);
    expect(sql).toMatch(/create table public\.settlement_share_tokens/i);
    expect(sql).toMatch(/unique \(settlement_id\)/i);
    expect(sql).toMatch(
      /alter table public\.notice_share_tokens enable row level security/i,
    );
    expect(sql).toMatch(
      /alter table public\.settlement_share_tokens enable row level security/i,
    );
    expect(sql).toMatch(
      /revoke select, insert, update, delete on table public\.notice_share_tokens\s+from public, anon, authenticated/i,
    );
    expect(sql).toMatch(
      /revoke select, insert, update, delete on table public\.settlement_share_tokens\s+from public, anon, authenticated/i,
    );
  });

  it("gates notice minting by org, messaging access, and published status", () => {
    const body = functionBody(
      "mint_notice_share_token",
      "create or replace function public.mint_settlement_share_token",
    );
    expect(body).toMatch(/security definer/i);
    expect(body).toMatch(/current_user_org\(\)/i);
    expect(body).toMatch(/current_user_has_module\('messaging'\)/i);
    expect(body).toMatch(/n\.org_id = v_org/i);
    expect(body).toMatch(/n\.published_at <= now\(\)/i);
    expect(body).toMatch(/on conflict \(notice_id\) do update/i);
    expect(body).toMatch(/set expires_at = excluded\.expires_at/i);
  });

  it("gates settlement minting by org, moving access, and completed status", () => {
    const body = functionBody(
      "mint_settlement_share_token",
      "create or replace function public.public_notice_by_token",
    );
    expect(body).toMatch(/security definer/i);
    expect(body).toMatch(/current_user_has_module\('moving'\)/i);
    expect(body).toMatch(/b\.org_id = v_org/i);
    expect(body).toMatch(/s\.status = 'completed'/i);
    expect(body).toMatch(/on conflict \(settlement_id\) do update/i);
  });

  it("exposes masked, whitelisted notice JSON to anonymous callers", () => {
    const body = functionBody(
      "public_notice_by_token",
      "create or replace function public.public_settlement_by_token",
    );
    for (const key of [
      "title",
      "content",
      "notice_type",
      "building_name",
      "published_at",
      "is_expired",
    ]) {
      expect(body).toContain(`'${key}'`);
    }
    expect(body).toMatch(/case when nst\.expires_at > now\(\)/i);
    expect(body).not.toMatch(/tenant_name|phone|created_by/i);
    expect(sql).toMatch(
      /grant execute on function public\.public_notice_by_token\(uuid\)\s+to anon, authenticated/i,
    );
  });

  it("exposes masked, whitelisted settlement JSON without PII", () => {
    const body = functionBody(
      "public_settlement_by_token",
      "revoke all on function public.mint_notice_share_token",
    );
    for (const key of [
      "move_out_date",
      "settlement_kind",
      "settlement_amount",
      "unit_label",
      "building_name",
      "is_expired",
    ]) {
      expect(body).toContain(`'${key}'`);
    }
    expect(body).toMatch(/case when sst\.expires_at > now\(\)/i);
    expect(body).not.toMatch(
      /tenant_name|phone|occupancy_id|settle_bank|settle_acct|settle_holder/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.public_settlement_by_token\(uuid\)\s+to anon, authenticated/i,
    );
  });
});
