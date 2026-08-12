// lib/export/xlsx.test.ts
import { describe, it, expect } from "vitest";
import { rowsToXlsxBuffer } from "./xlsx";

describe("rowsToXlsxBuffer", () => {
  it("xlsx(zip) 시그니처(PK) 버퍼 생성", async () => {
    const buf = await rowsToXlsxBuffer(
      [{ header: "건물명", key: "name" }, { header: "주소", key: "address" }],
      [{ name: "가나빌", address: "서울" }],
    );
    expect(buf.length).toBeGreaterThan(0);
    // xlsx는 zip → 첫 2바이트 'PK' (0x50 0x4b)
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it("빈 rows도 안전", async () => {
    const buf = await rowsToXlsxBuffer([{ header: "A", key: "a" }], []);
    expect(buf.length).toBeGreaterThan(0);
  });
});
