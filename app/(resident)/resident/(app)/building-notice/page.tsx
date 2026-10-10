import Link from "next/link";

import MobileBackHeader from "@/app/(resident)/_components/MobileBackHeader";
import NoticeDocument from "@/app/(resident)/_components/NoticeDocument";
import { noticeDetailClasses as styles } from "@/app/(resident)/_components/noticeDetailClasses";
import { createClient } from "@/lib/supabase/server";

import ResidentNoticeRetryState from "../notice/ResidentNoticeRetryState";

/**
 * 홈 상단 「건물 공지」(건물 상시 안내문) 전문 화면 — 알림 목록에서 여는 공지 상세와 같은 화면 틀.
 * 상시 안내문은 공지 글(id)이 아니라 건물 부가정보 텍스트라 별도 경로로 둔다.
 */
export default async function ResidentBuildingNoticePage() {
  const header = (
    <MobileBackHeader variant="detail" href="/resident/home" label="홈으로 돌아가기" title="공지" />
  );

  const supabase = await createClient();
  const [noticeResult, linkResult] = await Promise.all([
    supabase.rpc("resident_building_notice"),
    supabase.rpc("resident_my_link"),
  ]);

  if (noticeResult.error || linkResult.error) {
    return (
      <div className={styles.page}>
        {header}
        <ResidentNoticeRetryState className={styles.center} message="건물 공지를 불러오지 못했어요." />
      </div>
    );
  }

  const text = typeof noticeResult.data === "string" ? noticeResult.data.trim() : "";
  const link = ((linkResult.data ?? []) as Array<{ building_name: string | null }>)[0];

  if (!text) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.center} role="status">
          <b>등록된 건물 공지가 없어요.</b>
          <Link href="/resident/home">홈으로 가기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {header}
      <main className={styles.scroll}>
        <NoticeDocument
          noticeType="normal"
          title="건물 공지"
          publishedAt={null}
          buildingName={link?.building_name ?? null}
          contentJson={null}
          content={text}
          imageUrls={{}}
        />
      </main>
    </div>
  );
}
