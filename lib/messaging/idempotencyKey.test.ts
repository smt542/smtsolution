import { describe, expect, it } from "vitest";
import { newUuid, resolveIdempotencyKey } from "./idempotencyKey";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("newUuid", () => {
  it("UUID 형식 문자열을 만들고 매번 다르다", () => {
    const a = newUuid();
    const b = newUuid();
    expect(a).toMatch(UUID_RE);
    expect(b).toMatch(UUID_RE);
    expect(a).not.toBe(b);
  });
});

describe("resolveIdempotencyKey", () => {
  it("이전 값이 없으면 새 키를 생성한다", () => {
    let n = 0;
    const gen = () => `key-${(n += 1)}`;
    const out = resolveIdempotencyKey(null, "sig-1", gen);
    expect(out).toEqual({ signature: "sig-1", key: "key-1" });
  });

  it("동일 서명이면 같은 키를 재사용한다(중복 클릭·재시도 안정)", () => {
    const prev = { signature: "sig-1", key: "key-1" };
    const out = resolveIdempotencyKey(prev, "sig-1", () => "key-2");
    expect(out).toBe(prev); // 같은 참조/같은 키
    expect(out.key).toBe("key-1");
  });

  it("서명이 바뀌면(초안 실질 변경) 새 키로 회전한다", () => {
    const prev = { signature: "sig-1", key: "key-1" };
    const out = resolveIdempotencyKey(prev, "sig-2", () => "key-2");
    expect(out).toEqual({ signature: "sig-2", key: "key-2" });
  });
});
