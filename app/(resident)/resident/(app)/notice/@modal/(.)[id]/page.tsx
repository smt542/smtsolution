import NoticeDocument from "@/app/(resident)/_components/NoticeDocument";
import ResidentNoticeSheet from "@/app/(resident)/_components/ResidentNoticeSheet";

import { getResidentNoticeDetailPageData } from "../../data";
import ResidentNoticeReadTracker from "../../[id]/ResidentNoticeReadTracker";

/**
 * 공지 목록에서 공지를 눌렀을 때 /resident/notice/[id] 를 가로채 목록 위 바텀시트로 보여준다.
 * 데이터·본문 렌더는 상세 화면([id]/page)과 같은 것을 쓴다(이미지 signed URL 포함).
 */
export default async function ResidentNoticeSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idSegment } = await params;
  const parsedId = Number(idSegment);
  const id = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : 0;

  let pageData: Awaited<ReturnType<typeof getResidentNoticeDetailPageData>> | null = null;
  let failed = false;
  if (id) {
    try {
      pageData = await getResidentNoticeDetailPageData(id);
    } catch {
      failed = true;
    }
  }

  const detail = pageData?.detail ?? null;
  if (!detail) {
    return (
      <ResidentNoticeSheet>
        <p className="py-10 text-center text-[14px] font-semibold text-t3" role="status">
          {failed ? "공지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." : "공지 내용을 찾을 수 없어요."}
        </p>
      </ResidentNoticeSheet>
    );
  }

  return (
    <ResidentNoticeSheet>
      <ResidentNoticeReadTracker noticeId={detail.id} refreshOnRead />
      <NoticeDocument
        noticeType={detail.noticeType}
        title={detail.title}
        publishedAt={detail.publishedAt}
        buildingName={pageData?.residentBuildingName ?? detail.buildingName}
        contentJson={detail.contentJson}
        content={detail.content}
        imageUrls={pageData?.imageUrls ?? {}}
      />
    </ResidentNoticeSheet>
  );
}
