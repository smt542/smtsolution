"use client";

import { useState } from "react";

import styles from "./notify.module.css";

export default function NotificationSwitch() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  return (
    <button
      type="button"
      role="switch"
      aria-label="알림톡 받기"
      aria-checked={notificationsEnabled}
      className={`${styles.sw} ${notificationsEnabled ? styles.on : ""}`}
      onClick={() => setNotificationsEnabled((enabled) => !enabled)}
    >
      <i />
    </button>
  );
}
