import scaffoldStyles from "@/app/(resident)/_components/OnboardingPageScaffold.module.css";

import NotificationSwitch from "./NotificationSwitch";
import NotifyNavigationButton from "./NotifyNavigationButton";
import styles from "./notify.module.css";

export default function ResidentNotifyPage() {
  return (
    <>
      <div className={scaffoldStyles.hdr}>
        <NotifyNavigationButton
          href="/resident/verify"
          className={scaffoldStyles.bk}
          ariaLabel="이전 화면"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </NotifyNavigationButton>
      </div>

      <div className={scaffoldStyles.flowBody}>
        <h1 className={scaffoldStyles.flowTitle}>알림을 받아보세요</h1>
        <p className={scaffoldStyles.flowLead}>
          관리비가 확정되거나 건물 공지가 올라오면
          <br />
          카카오톡으로 바로 알려드려요.
        </p>

        <div className={styles.items}>
          <div className={styles.it}>
            <div className={styles.ic}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 5h10l4 4v10H5z" />
                <path d="M8 12h8M8 16h5" />
              </svg>
            </div>
            <div className={styles.tx}>
              <b>알림톡 받기</b>
              <span>관리비 발행과 건물 공지를 알려드려요</span>
            </div>
            <NotificationSwitch />
          </div>
        </div>
        <div className={styles.note}>
          알림은 언제든 내 정보에서 다시 끄고 켤 수 있어요.
        </div>
      </div>

      <div className={scaffoldStyles.foot}>
        <NotifyNavigationButton
          href="/resident/home"
          className={`${styles.btn} ${styles.pri}`}
        >
          시작하기
        </NotifyNavigationButton>
      </div>
    </>
  );
}
