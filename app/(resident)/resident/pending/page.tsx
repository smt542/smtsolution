import { ResidentPendingClient } from "./ResidentPendingClient";
import styles from "./pending.module.css";

export default function ResidentPendingPage() {
  return (
    <ResidentPendingClient
      title="확인 요청을 보냈어요"
      lead={
        <>
          관리사무소에서 세대를 확인하면
          <br />
          알림으로 알려드려요. 보통 1영업일 안에 처리돼요.
        </>
      }
      icon={
        <div className={styles.ring}>
          <div className={styles.wave} />
          <div className={styles.core}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </svg>
          </div>
        </div>
      }
    />
  );
}
