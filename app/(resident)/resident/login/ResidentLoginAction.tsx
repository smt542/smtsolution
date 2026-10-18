"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import ResidentBottomSheet from "@/app/(resident)/_components/ResidentBottomSheet";
import { kakaoStubLogin } from "@/lib/resident/onboardingClient";
import { showResidentToast } from "@/app/(resident)/_components/residentToast";
import { ORG_SUSPENDED_ERROR, RESIDENT_ORG_SUSPENDED_MESSAGE } from "@/lib/auth/orgSuspended";

import { loginClasses as styles } from "./loginClasses";
import { ResidentButton, residentButtonClass } from "@/app/(resident)/_components/ResidentButton";

const OAUTH_ERROR_MESSAGE: Record<string, string> = {
  cancelled: "카카오 로그인이 취소됐어요. 다시 시도해 주세요.",
  invalid_state: "로그인 요청이 만료됐어요. 다시 시도해 주세요.",
  missing_code: "카카오 인증 정보를 받지 못했어요. 다시 시도해 주세요.",
  provider_unavailable: "카카오 로그인에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
  session_failed: "로그인 세션을 만들지 못했어요. 다시 시도해 주세요.",
  [ORG_SUSPENDED_ERROR]: RESIDENT_ORG_SUSPENDED_MESSAGE,
};

export default function ResidentLoginAction({ oauthError }: { oauthError: string | null }) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const realKakaoLoginEnabled =
    process.env.NEXT_PUBLIC_KAKAO_LOGIN_ENABLED === "true";

  useEffect(() => {
    if (!oauthError) return;
    showResidentToast(OAUTH_ERROR_MESSAGE[oauthError] ?? "로그인하지 못했어요. 다시 시도해 주세요.");
    router.replace("/resident/login");
  }, [oauthError, router]);

  const continueWithMatchedIdentity = async () => {
    setSheetOpen(false);
    await kakaoStubLogin();
    router.push("/resident/auth");
  };

  return (
    <>
      <div className={styles.foot}>
        {/* 정본처럼 카카오 버튼은 연결 확인 시트를 먼저 연다. 실 OAuth·스텁 분기는 시트의 [계속하기]에서 한다. */}
        <ResidentButton
          variant="kakao"
          size="xl"
          type="button"
          className={styles.kakao}
          onClick={() => setSheetOpen(true)}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3.6c-4.86 0-8.8 3.02-8.8 6.75 0 2.4 1.62 4.51 4.06 5.72l-.98 3.6c-.9.33.25.6.53.43l4.32-2.84c.28.02.57.04.87.04 4.86 0 8.8-3.02 8.8-6.95S16.86 3.6 12 3.6z" />
          </svg>
          카카오톡으로 3초 만에 시작
        </ResidentButton>
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
        {realKakaoLoginEnabled ? (
          <a
            className={residentButtonClass({ className: "mt-5 flex w-full items-center justify-center" })}
            href="/api/resident/kakao/login"
            onClick={() => setSheetOpen(false)}
          >
            계속하기
          </a>
        ) : (
          <ResidentButton
            variant="primary"
            type="button"
            className="mt-5 w-full"
            onClick={continueWithMatchedIdentity}
          >
            계속하기
          </ResidentButton>
        )}
      </ResidentBottomSheet>
    </>
  );
}
