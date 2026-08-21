import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAlimtalkConfig, isAlimtalkConfigured, sendAlimtalkViaNcp } from "./alimtalk";

const KEYS = [
  "NCP_SENS_ACCESS_KEY",
  "NCP_SENS_SECRET_KEY",
  "NCP_ALIMTALK_SERVICE_ID",
  "NCP_ALIMTALK_CHANNEL_ID",
  "NCP_SENS_API_ENDPOINT",
];
function clearEnv() { KEYS.forEach((k) => delete process.env[k]); }
function setEnv() {
  process.env.NCP_SENS_ACCESS_KEY = "AK";
  process.env.NCP_SENS_SECRET_KEY = "SK";
  process.env.NCP_ALIMTALK_SERVICE_ID = "asvc";
  process.env.NCP_ALIMTALK_CHANNEL_ID = "@ch";
}

describe("isAlimtalkConfigured / getAlimtalkConfig", () => {
  beforeEach(clearEnv);
  afterEach(clearEnv);

  it("env 미설정이면 미구성", () => {
    expect(isAlimtalkConfigured()).toBe(false);
    expect(getAlimtalkConfig()).toBeNull();
  });

  it("필수 env가 하나라도 없으면 미구성", () => {
    process.env.NCP_SENS_ACCESS_KEY = "AK";
    process.env.NCP_SENS_SECRET_KEY = "SK";
    process.env.NCP_ALIMTALK_SERVICE_ID = "asvc";
    // channel id 누락
    expect(isAlimtalkConfigured()).toBe(false);
  });

  it("모든 필수 env 설정 시 구성됨(+기본 endpoint)", () => {
    setEnv();
    expect(isAlimtalkConfigured()).toBe(true);
    expect(getAlimtalkConfig()?.endpoint).toBe("https://sens.apigw.ntruss.com");
  });
});

describe("sendAlimtalkViaNcp", () => {
  beforeEach(clearEnv);
  afterEach(() => { clearEnv(); vi.unstubAllGlobals(); });

  it("미구성이면 발송하지 않고 예외(실발송 방지)", async () => {
    await expect(
      sendAlimtalkViaNcp({ to: "01012345678", templateCode: "T1", content: "hi" }),
    ).rejects.toThrow(/알림톡 미설정/);
  });

  it("구성 시 알림톡 엔드포인트로 서명 POST(plusFriendId·templateCode·buttons)", async () => {
    setEnv();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 202, json: async () => ({ requestId: "r1", statusCode: "202" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendAlimtalkViaNcp({
      to: "010-1234-5678", templateCode: "T1", content: "안녕하세요",
      buttons: [{ name: "확인하기", type: "WL", url: "https://x" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://sens.apigw.ntruss.com/alimtalk/v2/services/asvc/messages");
    expect(opts.headers["x-ncp-iam-access-key"]).toBe("AK");
    expect(opts.headers["x-ncp-apigw-signature-v2"]).toBeTruthy();
    const body = JSON.parse(opts.body);
    expect(body.plusFriendId).toBe("@ch");
    expect(body.templateCode).toBe("T1");
    expect(body.messages[0].to).toBe("01012345678");
    expect(body.messages[0].buttons[0].name).toBe("확인하기");
    expect(result.ok).toBe(true);
    expect(result.requestId).toBe("r1");
  });
});
