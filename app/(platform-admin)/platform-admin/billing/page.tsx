import { PlaceholderPage } from "../../_components/PageElements";

export default function PlatformBillingPage() {
  return (
    <>
      {/* TODO(billing): 구독/결제 스키마 연동 */}
      <PlaceholderPage
        eyebrow="BILLING"
        title="결제·구독"
        description="조직별 요금제, 구독 상태, 결제 내역을 관리할 영역입니다."
        icon={(
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" />
          </svg>
        )}
      />
    </>
  );
}
