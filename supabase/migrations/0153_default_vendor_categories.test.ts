import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "0153_default_vendor_categories.sql"), "utf8");

describe("0153 default vendor categories", () => {
  it("provisions the eight fixed prototype categories in order", () => {
    const defaults = [
      "청소 업체",
      "승강기보수업체",
      "CCTV 업체",
      "인터넷 업체",
      "소방검사업체",
      "정화조 업체",
      "전기안전업체",
      "승강기정기검사업체",
    ];

    defaults.forEach((label, sortOrder) => {
      expect(sql).toContain(`(${sortOrder}, '${label}')`);
    });
  });

  it("backfills existing orgs and provisions new orgs", () => {
    expect(sql).toContain("select id from public.organizations where deleted_at is null");
    expect(sql).toContain("after insert on public.organizations");
    expect(sql).toContain("perform public.provision_default_vendor_categories(new.id)");
  });

  it("normalizes legacy labels without orphaning their vendors", () => {
    expect(sql).toContain("regexp_replace(lower(label), '[[:space:]]+', '', 'g')");
    expect(sql).toContain("update public.vendors");
    expect(sql).toContain("set category_id = v_category_id");
    expect(sql).toContain("delete from public.vendor_categories");
  });

  it("does not expose the provisioning functions to app roles", () => {
    expect(sql).toContain(
      "revoke all on function public.provision_default_vendor_categories(bigint)",
    );
    expect(sql).toContain(
      "revoke all on function public.trg_provision_vendor_categories()",
    );
  });
});
