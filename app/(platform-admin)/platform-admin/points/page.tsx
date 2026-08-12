import { PlaceholderPage } from "../../_components/PageElements";

export default function PlatformPointsPage() {
  return (
    <>
      {/* TODO(points): 포인트 원장/정책 스키마 연동 */}
      <PlaceholderPage
        eyebrow="POINTS"
        title="포인트 관리"
        description="조직별 포인트 지급, 사용, 잔액 현황을 관리할 영역입니다."
        icon={(
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M9 8h4a2 2 0 0 1 0 4H9V8zm0 4h5a2 2 0 0 1 0 4H9v-4z" />
          </svg>
        )}
      />
    </>
  );
}
