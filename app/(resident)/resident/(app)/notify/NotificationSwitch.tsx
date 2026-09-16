"use client";

import { useState } from "react";

export default function NotificationSwitch() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  return (
    <button
      type="button"
      role="switch"
      aria-label="알림톡 받기"
      aria-checked={notificationsEnabled}
      className={`relative mt-[5px] h-[30px] w-[50px] flex-none rounded-pill p-0 transition-colors duration-200 ${notificationsEnabled ? "bg-blue" : "bg-line"}`}
      onClick={() => setNotificationsEnabled((enabled) => !enabled)}
    >
      <i className={`absolute left-[3px] top-[3px] size-6 rounded-full bg-white shadow-[0_2px_5px_rgba(23,31,40,0.2)] transition-transform duration-200 ${notificationsEnabled ? "translate-x-5" : ""}`} />
    </button>
  );
}
