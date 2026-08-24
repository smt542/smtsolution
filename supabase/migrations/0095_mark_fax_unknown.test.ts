import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "0095_popbill_dispatch_foundation.sql"), "utf8");

// mark_fax_dispatch_result 함수 본문만 추출한다.
const fnStart = sql.indexOf("create or replace function public.mark_fax_dispatch_result");
const fnEnd = sql.indexOf("revoke all on function public.mark_fax_dispatch_result", fnStart);
const markFaxFn = sql.slice(fnStart, fnEnd);

describe("0095 mark_fax_dispatch_result: queued는 accepted receipt에만", () => {
  it("함수 본문을 찾는다", () => {
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
  });

  it("accepted receipt 분기에서만 bill_issues.send_status='queued'로 표기한다(정확히 1회)", () => {
    // accepted 분기 1곳에서만 queued. 예전에는 unknown 분기에서도 queued로 표기해 receipt 없이 성공 접수로 오인됐다.
    expect((markFaxFn.match(/send_status = 'queued'/g) ?? []).length).toBe(1);
  });

  it("receiptless unknown 분기는 send_status를 queued로 바꾸지 않는다(불명확은 reconcile_required job이 원장)", () => {
    const unknownStart = markFaxFn.indexOf("p_outcome = 'unknown'");
    expect(unknownStart).toBeGreaterThan(-1);
    // unknown 분기 끝(다음 else)까지 잘라서 검사한다.
    const elseIdx = markFaxFn.indexOf("\n  else", unknownStart);
    const unknownBranch = markFaxFn.slice(unknownStart, elseIdx > -1 ? elseIdx : undefined);
    expect(unknownBranch).toContain("reconcile_required");
    expect(unknownBranch).not.toContain("send_status");
  });
});
