import Image from "next/image";
import type { Viewport } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { hasEntryPersona, isOrgSuspended } from "@/lib/auth/requirePersona";
import { ORG_SUSPENDED_ERROR } from "@/lib/auth/orgSuspended";
import ResidentLoginAction from "./ResidentLoginAction";
import { loginClasses as styles } from "./loginClasses";

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default async function ResidentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && (await hasEntryPersona(supabase, "resident", user.id))) {
    const [{ data: linkRows }, { data: pendingRows }] = await Promise.all([
      supabase.rpc("resident_my_link"),
      supabase.rpc("resident_pending_state"),
    ]);
    const link = Array.isArray(linkRows) ? linkRows[0] : linkRows;
    const pending = Array.isArray(pendingRows) ? pendingRows[0] : pendingRows;
    if (link) redirect("/resident/home");
    if (pending) redirect("/resident/pending");
    // 정지(계약 만료 포함) 테넌트 세입자는 본인인증으로 보내지 않고 세션을 끊어 안내한다.
    if ((await isOrgSuspended(supabase, "resident")) === true) {
      redirect(`/api/auth/switch-entry?to=resident&reason=${ORG_SUSPENDED_ERROR}`);
    }
    redirect("/resident/auth");
  }

  const params = await searchParams;
  const oauthError = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <div data-resident-login className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
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
      <ResidentLoginAction oauthError={oauthError ?? null} />
    </div>
  );
}
