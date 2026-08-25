import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(here, "0102_finalize_alimtalk_buttons.sql"),
  "utf8",
);

describe("finalize alimtalk buttons migration", () => {
  it("sets one valid WL 상세링크 button for each supported exact title", () => {
    expect(sql).toContain(
      `'[{"name":"고지서 상세보기","type":"WL","url":"#{상세링크}"}]'::jsonb`,
    );
    expect(sql).toContain(
      `where title in ('관리비 고지서', '관리비 미납 안내')`,
    );
    expect(sql).toContain(
      `'[{"name":"정산내역 보기","type":"WL","url":"#{상세링크}"}]'::jsonb`,
    );
    expect(sql).toContain(`where title = '이사정산 내역서'`);
    expect(sql).toContain(
      `'[{"name":"공지 확인하기","type":"WL","url":"#{상세링크}"}]'::jsonb`,
    );
    expect(sql).toContain(
      `where title in ('공지 안내(신규)', '공지 안내(중요)', '공지 안내(긴급)')`,
    );
  });

  it("does not modify the complaint template", () => {
    expect(sql).not.toContain("민원·AS 처리 안내");
  });
});
