"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type NotifyChoice = {
  enabled: boolean;
  toggle: () => void;
};

const NotifyChoiceContext = createContext<NotifyChoice | null>(null);

function useNotifyChoice(): NotifyChoice {
  const choice = useContext(NotifyChoiceContext);
  if (!choice) throw new Error("NotifyChoiceProvider 안에서만 사용할 수 있어요.");
  return choice;
}

/** 알림 설정 화면의 선택값(기본 ON)을 스위치와 「시작하기」 버튼이 함께 쓴다. */
export function NotifyChoiceProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);

  return (
    <NotifyChoiceContext.Provider value={{ enabled, toggle: () => setEnabled((value) => !value) }}>
      {children}
    </NotifyChoiceContext.Provider>
  );
}

export default function NotificationSwitch() {
  const { enabled: notificationsEnabled, toggle } = useNotifyChoice();

  return (
    <button
      type="button"
      role="switch"
      aria-label="알림톡 받기"
      aria-checked={notificationsEnabled}
      className={`relative mt-[5px] h-[30px] w-[50px] flex-none rounded-pill p-0 transition-colors duration-200 ${notificationsEnabled ? "bg-blue" : "bg-line"}`}
      onClick={toggle}
    >
      <i className={`absolute left-[3px] top-[3px] size-6 rounded-full bg-white shadow-[0_2px_5px_rgba(23,31,40,0.2)] transition-transform duration-200 ${notificationsEnabled ? "translate-x-5" : ""}`} />
    </button>
  );
}

export { useNotifyChoice };
