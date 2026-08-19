import Link from "next/link";

import styles from "../_legal.module.css";

export default function ResidentTermsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/resident/me" aria-label="내 정보로 돌아가기">‹</Link>
        <h1>이용약관</h1>
        <span aria-hidden="true" />
      </header>
      <main className={styles.content}>
        <h2>주택관리ERP 세입자 서비스 이용약관</h2>
        <p className={styles.note}>본 내용은 정식 약관 게시 전 확인을 위한 임시 안내입니다.</p>
        <h3>서비스 이용</h3>
        <p>세입자 서비스는 연결된 세대의 관리비, 공지사항, 알림 설정 및 퇴실 신청 기능을 제공합니다.</p>
        <h3>이용자의 의무</h3>
        <p>이용자는 본인에게 연결된 세대 정보를 안전하게 관리하고, 타인의 정보를 부정하게 이용하지 않아야 합니다.</p>
        <h3>문의</h3>
        <p>서비스 이용에 관한 문의는 해당 건물의 관리업체로 연락해 주세요.</p>
      </main>
    </div>
  );
}
