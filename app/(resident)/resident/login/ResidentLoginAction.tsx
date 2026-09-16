"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import ResidentBottomSheet from "@/app/(resident)/_components/ResidentBottomSheet";
import { kakaoStubLogin } from "@/lib/resident/onboardingClient";

import { loginClasses as styles } from "./loginClasses";

export default function ResidentLoginAction() {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const realKakaoLoginEnabled =
    process.env.NEXT_PUBLIC_KAKAO_LOGIN_ENABLED === "true";

  const continueWithMatchedIdentity = async () => {
    setSheetOpen(false);
    await kakaoStubLogin();
    router.push("/resident/auth");
  };

  return (
    <>
      <div className={styles.foot}>
        {realKakaoLoginEnabled ? (
          <a className={styles.kakao} href="/api/resident/kakao/login">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 3.6c-4.86 0-8.8 3.02-8.8 6.75 0 2.4 1.62 4.51 4.06 5.72l-.98 3.6c-.9.33.25.6.53.43l4.32-2.84c.28.02.57.04.87.04 4.86 0 8.8-3.02 8.8-6.95S16.86 3.6 12 3.6z" />
            </svg>
            카카오톡으로 3초 만에 시작
          </a>
        ) : (
          <button
            type="button"
            className={styles.kakao}
            onClick={() => setSheetOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 3.6c-4.86 0-8.8 3.02-8.8 6.75 0 2.4 1.62 4.51 4.06 5.72l-.98 3.6c-.9.33.25.6.53.43l4.32-2.84c.28.02.57.04.87.04 4.86 0 8.8-3.02 8.8-6.95S16.86 3.6 12 3.6z" />
            </svg>
            카카오톡으로 3초 만에 시작
          </button>
        )}
        <div className={styles.note}>
          <Link href="/resident/terms">이용약관</Link> ·{" "}
          <Link href="/resident/privacy">개인정보 처리방침</Link>에 동의하고 시작합니다
        </div>
      </div>

      <ResidentBottomSheet
        variant="compact"
        open={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
      >
        <div className={styles.sheetT}>카카오 로그인으로 연결할까요?</div>
        <div className={styles.sheetD}>
          카카오톡에 등록된 휴대폰 번호로 세대 정보를 자동으로 찾아드려요.
        </div>
        <button
          type="button"
          className={styles.sheetBtn}
          onClick={continueWithMatchedIdentity}
        >
          계속하기
        </button>
      </ResidentBottomSheet>
    </>
  );
}
