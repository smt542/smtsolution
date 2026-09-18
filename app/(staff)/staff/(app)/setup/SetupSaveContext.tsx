"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * 셋업 설정의 헤더 저장 버튼 ↔ 활성 탭 폼 사이의 배선.
 *
 * 정본은 헤더에 저장 버튼이 하나뿐이다. 어떤 탭이 열려 있든 그 버튼이 지금 보이는 폼을
 * 저장해야 하므로, 폼을 가진 탭이 자기 저장 함수를 여기에 등록하고 헤더가 그것을 호출한다.
 *
 * 목록형(A/S 접수 유형·정산 체크 항목)은 추가·수정·삭제가 즉시 저장되므로 등록하지 않는다.
 * 등록된 핸들러가 없으면 저장할 대상이 없다는 뜻이라 헤더 버튼은 비활성이 된다
 * (2026-09-18 사용자 결정: 폼만 헤더 저장 · 리스트는 즉시 저장 유지).
 */
type SetupSaveHandler = {
  save: () => void | Promise<unknown>;
  saving: boolean;
};

type SetupSaveValue = {
  handler: SetupSaveHandler | null;
  setHandler: (handler: SetupSaveHandler | null) => void;
};

const SetupSaveContext = createContext<SetupSaveValue | null>(null);

export function SetupSaveProvider({ children }: { children: React.ReactNode }) {
  const [handler, setHandler] = useState<SetupSaveHandler | null>(null);
  const value = useMemo(() => ({ handler, setHandler }), [handler]);
  return <SetupSaveContext.Provider value={value}>{children}</SetupSaveContext.Provider>;
}

/** 헤더 저장 버튼이 쓴다. */
export function useSetupSaveTarget(): SetupSaveHandler | null {
  return useContext(SetupSaveContext)?.handler ?? null;
}

/**
 * 폼을 가진 탭이 자기 저장 함수를 등록한다. 탭이 언마운트되면 해제되므로
 * 탭을 옮기면 헤더 버튼은 새 탭의 폼을 가리킨다.
 */
export function useRegisterSetupSave(save: () => void | Promise<unknown>, saving: boolean): void {
  const ctx = useContext(SetupSaveContext);
  const setHandler = ctx?.setHandler;
  // save는 매 렌더 새 함수로 오기 쉬워 의존성에서 빼고 최신 것을 ref처럼 다시 등록한다.
  const stableSave = useCallback(() => save(), [save]);

  useEffect(() => {
    if (!setHandler) return;
    setHandler({ save: stableSave, saving });
    return () => setHandler(null);
  }, [setHandler, stableSave, saving]);
}
