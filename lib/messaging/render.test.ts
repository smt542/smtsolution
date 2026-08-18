import { describe, it, expect } from "vitest";
import { extractVariables, renderTemplate } from "./render";

describe("messaging render", () => {
  it("extractVariables: 중복 제거·공백 트림", () => {
    expect(extractVariables("#{이름}님 #{호실} #{이름}")).toEqual(["이름", "호실"]);
    expect(extractVariables("변수 없음")).toEqual([]);
  });
  it("renderTemplate: 알려진 변수 치환", () => {
    expect(renderTemplate("#{이름}님 #{호실}호", { 이름: "홍길동", 호실: "101" }))
      .toBe("홍길동님 101호");
  });
  it("renderTemplate: 미정의 변수는 리터럴 유지", () => {
    expect(renderTemplate("#{이름}/#{금액}", { 이름: "홍길동" })).toBe("홍길동/#{금액}");
  });
  it("renderTemplate: 빈 vars·빈 본문", () => {
    expect(renderTemplate("고정문구", {})).toBe("고정문구");
    expect(renderTemplate("", { 이름: "x" })).toBe("");
  });
});
