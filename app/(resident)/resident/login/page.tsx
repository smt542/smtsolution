import Image from "next/image";

import ResidentLoginAction from "./ResidentLoginAction";
import { loginClasses as styles } from "./loginClasses";

export default function ResidentLoginPage() {
  return (
    <>
      <div className={styles.glow} />
      <div className={styles.top}>
        <div className={styles.brand}>
          <Image src="/logo-mark.png" alt="" width={26} height={26} />
          <b>
            관리<em>비서</em>
          </b>
        </div>
        <h1 className={styles.h1}>
          이번 달 관리비,
          <br />
          <span>앱에서 바로 확인</span>하세요
        </h1>
        <p className={styles.lead}>
          고지서 없이도 항목별 금액과 납부일까지
          <br />
          한눈에. 납부 계좌도 바로 복사해요.
        </p>
      </div>
      <div className={styles.stagearea}>
        <div className={styles.cards}>
          <div className={styles.cardB} />
          <div className={styles.card}>
            <div className={styles.cardIn}>
              <div className={styles.cw}>
                <span>2026년 8월 관리비</span>
                <span className={styles.chip}>납부 완료</span>
              </div>
              <div className={styles.amt}>
                128,400<i>원</i>
              </div>
              <div className={styles.meta}>8월 21일 납부 · 그린빌라 201호</div>
              <div className={styles.split} />
              <div className={styles.mini}>
                <span>일반관리비</span>
                <b>62,000원</b>
              </div>
              <div className={styles.mini}>
                <span>전기</span>
                <b>38,700원</b>
              </div>
              <div className={styles.mini}>
                <span>수도 · 가스</span>
                <b>27,700원</b>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ResidentLoginAction />
    </>
  );
}
