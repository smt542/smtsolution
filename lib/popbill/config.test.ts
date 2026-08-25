import { describe, expect, it } from "vitest";
import {
  PopbillNotConfiguredError,
  isPopbillConfigured,
  parsePopbillBoolean,
  readPopbillConfig,
  requirePopbillSender,
} from "./config";

const base = {
  POPBILL_LINK_ID: "TESTLINK",
  POPBILL_SECRET_KEY: "s3cr3t",
  POPBILL_CORP_NUM: "123-45-67890",
};

describe("parsePopbillBoolean", () => {
  it("truthy 문자열을 true로 파싱한다", () => {
    for (const v of ["true", "TRUE", "1", "yes", "on", " Y "]) {
      expect(parsePopbillBoolean(v, false)).toBe(true);
    }
  });
  it("falsy 문자열을 false로 파싱한다", () => {
    for (const v of ["false", "0", "no", "off", "N", ""]) {
      expect(parsePopbillBoolean(v, true)).toBe(false);
    }
  });
  it("undefined는 기본값을 사용한다", () => {
    expect(parsePopbillBoolean(undefined, true)).toBe(true);
    expect(parsePopbillBoolean(undefined, false)).toBe(false);
  });
});

describe("readPopbillConfig", () => {
  it("필수 키가 없으면 PROVIDER_NOT_CONFIGURED 오류를 던진다", () => {
    expect(() => readPopbillConfig({})).toThrowError(PopbillNotConfiguredError);
    try {
      readPopbillConfig({ POPBILL_LINK_ID: "x", POPBILL_SECRET_KEY: "y" });
    } catch (e) {
      expect((e as PopbillNotConfiguredError).code).toBe("PROVIDER_NOT_CONFIGURED");
    }
  });

  it("오류 메시지에 비밀값을 포함하지 않는다", () => {
    try {
      readPopbillConfig({ POPBILL_LINK_ID: "x", POPBILL_SECRET_KEY: "SUPERSECRET" });
    } catch (e) {
      expect((e as Error).message).not.toContain("SUPERSECRET");
    }
  });

  it("필수 키를 trim하고 사업자번호에서 숫자만 남긴다", () => {
    const cfg = readPopbillConfig({ ...base, POPBILL_LINK_ID: " TESTLINK " });
    expect(cfg.linkId).toBe("TESTLINK");
    expect(cfg.secretKey).toBe("s3cr3t");
    expect(cfg.corpNum).toBe("1234567890");
  });

  it("IS_TEST 기본값은 test 모드(true), false 지정 시 운영 모드", () => {
    expect(readPopbillConfig({ ...base }).isTest).toBe(true);
    expect(readPopbillConfig({ ...base, POPBILL_IS_TEST: "false" }).isTest).toBe(false);
    expect(readPopbillConfig({ ...base, POPBILL_IS_TEST: "true" }).isTest).toBe(true);
  });

  it("boolean 플래그를 파싱한다", () => {
    const cfg = readPopbillConfig({
      ...base,
      POPBILL_IP_RESTRICT_ON: "false",
      POPBILL_USE_STATIC_IP: "true",
      POPBILL_USE_LOCAL_TIME: "false",
    });
    expect(cfg.ipRestrictOn).toBe(false);
    expect(cfg.useStaticIp).toBe(true);
    expect(cfg.useLocalTime).toBe(false);
  });

  it("발신번호는 숫자만 남기고 카카오 채널은 trim한다", () => {
    const cfg = readPopbillConfig({
      ...base,
      POPBILL_SMS_SENDER: "02-123-4567",
      POPBILL_KAKAO_SENDER: " @채널 ",
      POPBILL_FAX_SENDER: "031-9999-0000",
    });
    expect(cfg.smsSender).toBe("021234567");
    expect(cfg.kakaoSender).toBe("@채널");
    expect(cfg.faxSender).toBe("03199990000");
  });
});

describe("isPopbillConfigured", () => {
  it("필수 키가 있으면 true, 없으면 false", () => {
    expect(isPopbillConfigured(base)).toBe(true);
    expect(isPopbillConfigured({})).toBe(false);
  });
});

describe("requirePopbillSender", () => {
  it("제품별 등록 발신번호를 반환한다", () => {
    const cfg = readPopbillConfig({
      ...base,
      POPBILL_SMS_SENDER: "0212345678",
      POPBILL_KAKAO_SENDER: "@채널",
      POPBILL_FAX_SENDER: "0319990000",
    });
    expect(requirePopbillSender(cfg, "sms")).toBe("0212345678");
    expect(requirePopbillSender(cfg, "lms")).toBe("0212345678");
    expect(requirePopbillSender(cfg, "alimtalk")).toBe("@채널");
    expect(requirePopbillSender(cfg, "fax")).toBe("0319990000");
  });

  it("해당 제품 발신번호가 없으면 PROVIDER_NOT_CONFIGURED 오류", () => {
    const cfg = readPopbillConfig({ ...base });
    expect(() => requirePopbillSender(cfg, "sms")).toThrowError(PopbillNotConfiguredError);
    expect(() => requirePopbillSender(cfg, "fax")).toThrowError(PopbillNotConfiguredError);
  });
});
