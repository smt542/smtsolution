import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "0120_required_utility_fee_items.sql"), "utf8");

describe("0120 required utility fee items", () => {
  it("backfills and seeds the three canonical items for every building type", () => {
    expect(sql).toContain("('전기'::text, 0)");
    expect(sql).toContain("('수도료'::text, 1)");
    expect(sql).toContain("('가스'::text, 2)");
    expect(sql).toContain("select public.ensure_required_utility_fee_items(id)");
    expect(sql).toContain("after insert on public.building_types");
  });

  it("reactivates required rows and prevents required flags from being disabled", () => {
    expect(sql).toContain("on conflict (type_id, name) do update set");
    expect(sql).toContain("is_required = true");
    expect(sql).toContain("deleted_at = null");
    expect(sql).toContain("fee_items_required_utility_active");
  });

  it("restores a canonical item after a direct delete or rename", () => {
    expect(sql).toContain("fee_items_restore_deleted_required_utility");
    expect(sql).toContain("fee_items_restore_renamed_required_utility");
  });
});
