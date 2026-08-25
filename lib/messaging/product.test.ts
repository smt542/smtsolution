import { describe, expect, it } from "vitest";
import { classifyMessageProduct, popbillByteLength } from "./product";

describe("popbillByteLength", () => {
  it("ASCII 문자는 1바이트로 계산한다", () => {
    expect(popbillByteLength("abc123")).toBe(6);
    expect(popbillByteLength("")).toBe(0);
  });
  it("한글 등 비ASCII 문자는 2바이트로 계산한다", () => {
    expect(popbillByteLength("가나다")).toBe(6);
    expect(popbillByteLength("가A")).toBe(3);
  });
  it("코드포인트 단위(서로게이트 페어)로 계산한다", () => {
    // 이모지(BMP 밖) 1문자 = 2바이트
    expect(popbillByteLength("😀")).toBe(2);
  });
});

describe("classifyMessageProduct", () => {
  it("90바이트 이하는 sms", () => {
    // 45 한글 = 90바이트
    const body = "가".repeat(45);
    const r = classifyMessageProduct(body);
    expect(r).toEqual({ ok: true, product: "sms", bytes: 90 });
  });
  it("91바이트는 lms", () => {
    // 45 한글 + 1 ASCII = 91바이트
    const body = "가".repeat(45) + "a";
    const r = classifyMessageProduct(body);
    expect(r).toEqual({ ok: true, product: "lms", bytes: 91 });
  });
  it("2000바이트는 lms", () => {
    const body = "가".repeat(1000); // 2000바이트
    const r = classifyMessageProduct(body);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.product).toBe("lms");
      expect(r.bytes).toBe(2000);
    }
  });
  it("2001바이트 초과는 MESSAGE_TOO_LONG으로 거절", () => {
    const body = "가".repeat(1000) + "a"; // 2001바이트
    const r = classifyMessageProduct(body);
    expect(r).toEqual({ ok: false, code: "MESSAGE_TOO_LONG", bytes: 2001 });
  });
  it("제목이 있으면 90바이트 이하라도 lms", () => {
    const r = classifyMessageProduct("짧은본문", "제목있음");
    expect(r).toEqual({ ok: true, product: "lms", bytes: popbillByteLength("짧은본문") });
  });
  it("공백만 있는 제목은 sms 판정에 영향을 주지 않는다", () => {
    const r = classifyMessageProduct("짧은본문", "   ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.product).toBe("sms");
  });
});
