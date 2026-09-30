"use client";

import { useCallback, useEffect } from "react";
import { appToast } from "./useAppToast";

// 카카오 우편번호 서비스. API 키가 없고 사용량 제한도 없다(postcode.map.kakao.com/guide).
const POSTCODE_SCRIPT_SRC = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
// 팝업 기본 크기(스크립트 DEFAULT_WIDTH·DEFAULT_HEIGHT). 앱 창 가운데에 띄울 때 쓴다.
const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 500;

interface PostcodeResult {
  address: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: "R" | "J";
}

interface PostcodeConstructor {
  new (options: { width: number; height: number; oncomplete: (data: PostcodeResult) => void }): {
    open(options: { popupTitle: string; popupKey: string; left: number; top: number }): void;
  };
}

declare global {
  interface Window {
    kakao?: { Postcode?: PostcodeConstructor };
  }
}

let scriptPromise: Promise<PostcodeConstructor> | null = null;

function loadPostcode(): Promise<PostcodeConstructor> {
  const loaded = window.kakao?.Postcode;
  if (loaded) return Promise.resolve(loaded);
  scriptPromise ??= new Promise<PostcodeConstructor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = POSTCODE_SCRIPT_SRC;
    script.async = true;
    const fail = () => {
      script.remove();
      reject(new Error("우편번호 서비스 스크립트를 불러오지 못했습니다"));
    };
    script.onload = () => {
      const Postcode = window.kakao?.Postcode;
      if (Postcode) resolve(Postcode);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    // 실패하면 다음 클릭에서 다시 받는다.
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

// 누른 주소 그대로: 도로명을 누르면 도로명, 지번을 누르면 지번 주소.
function pickAddress(data: PostcodeResult) {
  const picked = data.userSelectedType === "J" ? data.jibunAddress : data.roadAddress;
  return picked || data.address;
}

/** 주소 검색(카카오 우편번호 서비스)을 새 창으로 여는 함수를 돌려준다. 고른 주소는 onSelect로 넘긴다. */
export function useAddressSearchPopup(onSelect: (address: string) => void) {
  useEffect(() => {
    // 미리 받아 두면 클릭 처리 안에서 바로 창을 열어 팝업 차단에 걸리지 않는다.
    loadPostcode().catch(() => {});
  }, []);

  return useCallback(() => {
    const open = (Postcode: PostcodeConstructor) => {
      new Postcode({
        width: POPUP_WIDTH,
        height: POPUP_HEIGHT,
        oncomplete: (data) => onSelect(pickAddress(data)),
      }).open({
        popupTitle: "주소 검색",
        popupKey: "address-search",
        left: Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2),
        top: Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2),
      });
    };
    const loaded = window.kakao?.Postcode;
    if (loaded) open(loaded);
    else loadPostcode().then(open, () => appToast.error("주소 검색을 불러오지 못했어요"));
  }, [onSelect]);
}
