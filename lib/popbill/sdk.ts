import * as popbill from "popbill";
import { readPopbillConfig, type PopbillConfig } from "./config";

/**
 * Popbill 서비스 singleton — **서버 전용**.
 *
 * popbill 모듈 전역 config는 마지막 호출로 덮어써진다. 동일 설정이면 재설정을 건너뛰고,
 * 설정이 바뀌면 다시 적용한다. 어댑터(messages/fax/results)는 이 getter만 사용한다.
 */

let cachedKey: string | null = null;

function ensureConfigured(config: PopbillConfig): void {
  const key = [
    config.linkId,
    config.isTest,
    config.ipRestrictOn,
    config.useStaticIp,
    config.useLocalTime,
  ].join("|");
  if (cachedKey === key) return;
  popbill.config({
    LinkID: config.linkId,
    SecretKey: config.secretKey,
    IsTest: config.isTest,
    IPRestrictOnOff: config.ipRestrictOn,
    UseStaticIP: config.useStaticIp,
    UseLocalTimeYN: config.useLocalTime,
    // 공급자 오류는 어댑터의 error callback에서 정제해 처리한다. 전역 핸들러는 무음.
    defaultErrorHandler: () => {},
  });
  cachedKey = key;
}

export function getMessageService(config: PopbillConfig = readPopbillConfig()): popbill.MessageService {
  ensureConfigured(config);
  return popbill.MessageService();
}

export function getKakaoService(config: PopbillConfig = readPopbillConfig()): popbill.KakaoService {
  ensureConfigured(config);
  return popbill.KakaoService();
}

export function getFaxService(config: PopbillConfig = readPopbillConfig()): popbill.FaxService {
  ensureConfigured(config);
  return popbill.FaxService();
}
