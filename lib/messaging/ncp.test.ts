import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getNcpConfig, isNcpConfigured, makeNcpSignature, sendSmsViaNcp } from "./ncp";

const KEYS = [
  "NCP_SENS_ACCESS_KEY",
  "NCP_SENS_SECRET_KEY",
  "NCP_SENS_SERVICE_ID",
  "NCP_SENS_CALLER_NUMBER",
  "NCP_SENS_API_ENDPOINT",
];

function clearEnv() {
  KEYS.forEach((k) => delete process.env[k]);
}

describe("makeNcpSignature", () => {
  it("동일 입력에 대해 결정적 base64 서명을 생성", () => {
    const args = {
      method: "POST",
      uri: "/sms/v2/services/svc/messages",
      timestamp: "1700000000000",
      accessKey: "AK",
      secretKey: "SK",
    };
    const a = makeNcpSignature(args);
    const b = makeNcpSignature(args);
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("secretKey가 다르면 서명이 달라진다", () => {
    const base = {
      method: "POST",
      uri: "/sms/v2/services/svc/messages",
      timestamp: "1700000000000",
      accessKey: "AK",
    };
    expect(makeNcpSignature({ ...base, secretKey: "SK1" })).not.toBe(
      makeNcpSignature({ ...base, secretKey: "SK2" }),
    );
  });
});

describe("isNcpConfigured / getNcpConfig", () => {
  beforeEach(clearEnv);
  afterEach(clearEnv);

  it("env 미설정이면 미구성(stub 유지 게이트)", () => {
    expect(isNcpConfigured()).toBe(false);
    expect(getNcpConfig()).toBeNull();
  });

  it("필수 env가 하나라도 없으면 미구성", () => {
    process.env.NCP_SENS_ACCESS_KEY = "AK";
    process.env.NCP_SENS_SECRET_KEY = "SK";
    process.env.NCP_SENS_SERVICE_ID = "svc";
    // caller number 누락
    expect(isNcpConfigured()).toBe(false);
  });

  it("모든 필수 env 설정 시 구성됨(+기본 endpoint)", () => {
    process.env.NCP_SENS_ACCESS_KEY = "AK";
    process.env.NCP_SENS_SECRET_KEY = "SK";
    process.env.NCP_SENS_SERVICE_ID = "svc";
    process.env.NCP_SENS_CALLER_NUMBER = "0212345678";
    expect(isNcpConfigured()).toBe(true);
    expect(getNcpConfig()?.endpoint).toBe("https://sens.apigw.ntruss.com");
  });
});

describe("sendSmsViaNcp", () => {
  beforeEach(clearEnv);
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
  });

  it("미구성이면 발송하지 않고 예외(실발송 방지)", async () => {
    await expect(sendSmsViaNcp({ to: "01012345678", content: "hi" })).rejects.toThrow(
      /NCP SENS 미설정/,
    );
  });

  it("구성 시 서명 헤더와 함께 SENS 엔드포인트로 POST", async () => {
    process.env.NCP_SENS_ACCESS_KEY = "AK";
    process.env.NCP_SENS_SECRET_KEY = "SK";
    process.env.NCP_SENS_SERVICE_ID = "svc";
    process.env.NCP_SENS_CALLER_NUMBER = "0212345678";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ requestId: "r1", statusCode: "202" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendSmsViaNcp({ to: "010-1234-5678", content: "안녕하세요" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://sens.apigw.ntruss.com/sms/v2/services/svc/messages");
    expect(opts.headers["x-ncp-iam-access-key"]).toBe("AK");
    expect(opts.headers["x-ncp-apigw-signature-v2"]).toBeTruthy();
    const body = JSON.parse(opts.body);
    expect(body.from).toBe("0212345678");
    expect(body.messages[0].to).toBe("01012345678");
    expect(result.ok).toBe(true);
    expect(result.requestId).toBe("r1");
  });
});
