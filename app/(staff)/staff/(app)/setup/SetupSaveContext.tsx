"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * 셋업 설정의 헤더 저장 버튼 ↔ 활성 탭 폼 사이의 배선.
 *
 * 정본은 헤더에 저장 버튼이 하나뿐이다. 어떤 탭이 열려 있든 그 버튼이 지금 보이는 폼을
 * 저장해야 하므로, 폼을 가진 탭이 자기 저장 함수를 여기에 등록하고 헤더가 그것을 호출한다.
 *
 * 목록형(A/S 접수 유형·정산 체크 항목)은 추가·수정·삭제가 즉시 저장되므로 등록하지 않는다.
 * 등록된 핸들러가 없으면 저장할 대상이 없다는 뜻이라 헤더 버튼은 비활성이 된다
 * (2026-09-18 사용자 결정: 폼만 헤더 저장 · 리스트는 즉시 저장 유지).
 *
 * **탭의 save는 렌더마다 새 클로저다.** 그걸 그대로 등록하면 등록 → 리렌더 → 새 클로저 →
 * 재등록이 끝없이 돈다. 그래서 탭이 가진 로컬 ref에 최신 클로저를 담고, 컨텍스트에는
 * 그 ref를 읽는 **고정 identity 래퍼**만 등록한다. 등록 이펙트가 실제로 다시 도는 건
 * `saving`(불리언)이 바뀔 때뿐이다.
 */
type SaveFn = () => void | Promise<unknown>;

type SetupSaveHandler = { save: SaveFn; saving: boolean };

type SetupSaveValue = {
  handler: SetupSaveHandler | null;
  setHandler: React.Dispatch<React.SetStateAction<SetupSaveHandler | null>>;
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
export function useRegisterSetupSave(save: SaveFn, saving: boolean): void {
  const setHandler = useContext(SetupSaveContext)?.setHandler;

  // 렌더마다 새로 만들어지는 save를 로컬 ref에 담아 둔다. 이 ref는 이 훅이 만든 것이라
  // 수정할 수 있다(컨텍스트에서 받은 ref는 react-hooks/immutability가 막는다).
  const latest = useRef(save);
  useEffect(() => {
    latest.current = save;
  });

  // 컨텍스트에 등록되는 건 identity가 고정된 이 래퍼뿐이다.
  const stableSave = useCallback<SaveFn>(() => latest.current(), []);

  useEffect(() => {
    if (!setHandler) return;
    setHandler({ save: stableSave, saving });
    return () => setHandler(null);
  }, [setHandler, stableSave, saving]);
}
