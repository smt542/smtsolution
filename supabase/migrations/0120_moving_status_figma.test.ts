import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "0120_moving_status_figma.sql"), "utf8");

describe("0120 moving status Figma implementation", () => {
  it("returns the integrated electric/gas inquiry fields and Figma filters", () => {
    expect(sql).toContain("building_address text");
    expect(sql).toContain("elec_final_reading numeric");
    expect(sql).toContain("gas_move_reading numeric");
    expect(sql).toContain("inspector_name text");
    expect(sql).toContain("p_status = 'unresolved'");
    expect(sql).toContain("p_sort = 'date'");
  });

  it("keeps inquiry edits atomic and unavailable to anonymous users", () => {
    expect(sql).toContain("save_settlement_inquiry_edits(p_edits jsonb)");
    expect(sql).toContain("set move_cleaning_fee");
    expect(sql).toContain("revoke execute on function save_settlement_inquiry_edits(jsonb) from public, anon");
    expect(sql).toContain("grant execute on function save_settlement_inquiry_edits(jsonb) to authenticated");
  });
});
