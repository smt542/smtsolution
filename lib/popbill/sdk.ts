import * as popbill from "popbill";
import { readPopbillConfig, type PopbillConfig } from "./config";

/**
 * Popbill 서비스 singleton — **서버 전용**.
 *
 * popbill 모듈 전역 config는 마지막 호출로 덮어써진다. 동일 설정이면 재설정을 건너뛰고,
 * 설정이 바뀌면 다시 적용한다. 어댑터(messages/fax/results)는 이 getter만 사용한다.
 *
 * SDK 팩토리(`MessageService()` 등)는 `this._MessageService`에 인스턴스를 캐시하고 그 값을 반환한다.
 * `import * as`로 받은 네임스페이스는 쓰기가 불가능해 대입이 무시되고 `undefined`가 반환되므로,
 * 쓰기 가능한 holder를 `this`로 바인딩해 호출한다. SDK의 config()는 설정 객체를 통째로 교체해
 * 이미 만든 인스턴스는 이전 설정을 계속 쓰므로, 설정이 바뀌면 holder를 새로 만들어 인스턴스를 다시 생성한다.
 */

let cachedKey: string | null = null;
let serviceHolder: Record<string, unknown> = {};

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
  serviceHolder = {};
}

export function getMessageService(config: PopbillConfig = readPopbillConfig()): popbill.MessageService {
  ensureConfigured(config);
  return popbill.MessageService.call(serviceHolder);
}

export function getKakaoService(config: PopbillConfig = readPopbillConfig()): popbill.KakaoService {
  ensureConfigured(config);
  return popbill.KakaoService.call(serviceHolder);
}

export function getFaxService(config: PopbillConfig = readPopbillConfig()): popbill.FaxService {
  ensureConfigured(config);
  return popbill.FaxService.call(serviceHolder);
}
