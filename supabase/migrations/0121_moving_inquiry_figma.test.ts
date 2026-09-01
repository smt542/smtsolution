import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "0121_moving_inquiry_figma.sql"), "utf8");

describe("0121 Figma-aligned moving inquiry", () => {
  it("adds the editable cleaning cost and inspector fields", () => {
    expect(sql).toContain("add column if not exists cleaning_cost integer");
    expect(sql).toContain("add column if not exists checked_by uuid");
    expect(sql).toContain("checked_by = auth.uid()");
  });

  it("supports the unified status and sort filters", () => {
    expect(sql).toContain("p_status = 'incomplete' and s.status <> 'completed'");
    expect(sql).toContain("p_sort not in ('code', 'date')");
    expect(sql).toContain("case when p_sort = 'code' then b.code end");
    expect(sql).toContain("case when p_sort = 'date' then s.move_out_date end desc");
  });

  it("reads the latest electric and gas meter values for the move-out month", () => {
    expect(sql).toContain("reading.utility = 'elec'");
    expect(sql).toContain("reading.utility = 'gas'");
    expect(sql).toContain("reading.period <= date_trunc('month', s.move_out_date)::date");
  });

  it("keeps reads and writes inside the caller organization", () => {
    expect(sql).toContain("b.org_id = v_org");
    expect(sql).toContain("building.org_id = v_org");
    expect(sql).toContain("current_user_has_module('moving')");
  });
});
