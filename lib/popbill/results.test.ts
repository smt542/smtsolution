import { afterEach, describe, expect, it, vi } from "vitest";

const getMessages = vi.fn();
const kakaoGetMessages = vi.fn();
vi.mock("./sdk", () => ({
  getMessageService: () => ({ getMessages }),
  getKakaoService: () => ({ getMessages: kakaoGetMessages }),
}));

import {
  computeNextPollAt,
  fetchMessageResults,
  normalizeMessageResult,
} from "./results";
import type { PopbillConfig } from "./config";

const config: PopbillConfig = {
  linkId: "L",
  secretKey: "SECRET",
  corpNum: "1234567890",
  userId: "u",
  isTest: true,
  ipRestrictOn: true,
  useStaticIp: false,
  useLocalTime: true,
  smsSender: "0212345678",
  kakaoSender: "@ch",
  faxSender: "0311112222",
};

afterEach(() => vi.clearAllMocks());

describe("normalizeMessageResult", () => {
  it("state=3/result=100은 성공", () => {
    expect(normalizeMessageResult(3, 100)).toBe("success");
  });
  it("state=3의 다른 결과·알 수 없는 코드는 실패(terminal)", () => {
    expect(normalizeMessageResult(3, 1001)).toBe("failed");
    expect(normalizeMessageResult(3, 0)).toBe("failed");
  });
  it("state<3은 대기(pending)", () => {
    expect(normalizeMessageResult(0, 0)).toBe("pending");
    expect(normalizeMessageResult(2, 1)).toBe("pending");
  });
  it("취소 등 state>3은 실패(terminal)", () => {
    expect(normalizeMessageResult(4, 0)).toBe("failed");
  });
});

describe("computeNextPollAt", () => {
  const base = new Date("2026-08-24T00:00:00.000Z");
  it("최초 10분 이내는 1분 후", () => {
    const now = new Date(base.getTime() + 3 * 60_000);
    expect(computeNextPollAt(base, now)?.getTime()).toBe(now.getTime() + 60_000);
  });
  it("2시간까지는 5분 후", () => {
    const now = new Date(base.getTime() + 30 * 60_000);
    expect(computeNextPollAt(base, now)?.getTime()).toBe(now.getTime() + 5 * 60_000);
  });
  it("24시간까지는 30분 후", () => {
    const now = new Date(base.getTime() + 5 * 3_600_000);
    expect(computeNextPollAt(base, now)?.getTime()).toBe(now.getTime() + 30 * 60_000);
  });
  it("24시간 초과는 null(reconcile_required)", () => {
    const now = new Date(base.getTime() + 25 * 3_600_000);
    expect(computeNextPollAt(base, now)).toBeNull();
  });
});

describe("fetchMessageResults", () => {
  it("문자 결과를 interOPRefKey→상태로 매핑한다", async () => {
    getMessages.mockImplementation((...args: unknown[]) => {
      (args[3] as (r: unknown[]) => void)([
        { state: 3, result: 100, interOPRefKey: "r0" },
        { state: 2, result: 1, interOPRefKey: "r1" },
        { state: 3, result: 1001, interOPRefKey: "r2" },
        { state: 3, result: 100 }, // interOPRefKey 없음 → 제외
      ]);
    });
    const out = await fetchMessageResults(config, "sms", "RCPT-1");
    expect(out).toEqual([
      { providerRefKey: "r0", status: "success", code: "100" },
      { providerRefKey: "r1", status: "pending", code: "1" },
      { providerRefKey: "r2", status: "failed", code: "1001" },
    ]);
    expect(getMessages).toHaveBeenCalledWith("1234567890", "RCPT-1", "u", expect.any(Function), expect.any(Function));
  });

  it("알림톡은 KakaoService.getMessages를 사용한다", async () => {
    kakaoGetMessages.mockImplementation((...args: unknown[]) => {
      (args[3] as (r: unknown[]) => void)([{ state: 3, result: 100, interOPRefKey: "a0" }]);
    });
    const out = await fetchMessageResults(config, "alimtalk", "RCPT-A");
    expect(out).toEqual([{ providerRefKey: "a0", status: "success", code: "100" }]);
    expect(kakaoGetMessages).toHaveBeenCalled();
  });

  it("조회 오류는 비밀값 없이 reject된다", async () => {
    getMessages.mockImplementation((...args: unknown[]) => {
      (args[4] as (e: { code: number; message: string }) => void)({ code: -99, message: "err" });
    });
    const err = (await fetchMessageResults(config, "sms", "X").catch((e) => e)) as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).not.toContain("SECRET");
  });
});
