import Link from "next/link";

import styles from "../_legal.module.css";

export default function ResidentPrivacyPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/resident/me" aria-label="내 정보로 돌아가기">‹</Link>
        <h1>개인정보 처리방침</h1>
        <span aria-hidden="true" />
      </header>
      <main className={styles.content}>
        <h2>개인정보 처리방침</h2>
        <p className={styles.note}>본 내용은 정식 방침 게시 전 확인을 위한 임시 안내입니다.</p>
        <h3>처리하는 정보</h3>
        <p>서비스 제공을 위해 이름, 전화번호, 세대 연결 정보와 알림 수신 설정을 처리할 수 있습니다.</p>
        <h3>이용 목적</h3>
        <p>관리비 및 공지 안내, 세대 확인, 퇴실 신청 처리 등 세입자 서비스 운영에만 사용합니다.</p>
        <h3>보관 및 문의</h3>
        <p>관련 법령과 내부 정책에 따라 필요한 기간 동안 보관하며, 문의는 해당 관리업체로 접수해 주세요.</p>
      </main>
    </div>
  );
}
