"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

import BillDetailView from "@/app/(resident)/_components/BillDetailView";
import PublicTokenPageShell from "@/app/(resident)/_components/PublicTokenPageShell";
import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";
import { usePublicBillBySigned } from "@/hooks/reactquery/residentBilling";

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function PublicSignedBillContent() {
  const params = useParams<{ building: string; unit: string; period: string }>();
  const searchParams = useSearchParams();

  const buildingId = Number(params.building);
  // Next.js가 동적 세그먼트를 이미 디코드하므로 params.unit은 원본 unit_no와 동일하다
  // (서명 대상 값과 일치). sig는 base64url이라 인코딩/디코딩 불필요.
  const unitNo = params.unit ?? "";
  const period = params.period ?? "";
  const sig = searchParams.get("s") ?? "";
  const paramsValid =
    Number.isInteger(buildingId) &&
    buildingId > 0 &&
    Boolean(unitNo) &&
    PERIOD_PATTERN.test(period) &&
    Boolean(sig);

  const billQuery = usePublicBillBySigned(
    paramsValid ? buildingId : 0,
    paramsValid ? unitNo : "",
    paramsValid ? period : "",
    paramsValid ? sig : "",
  );

  if (!paramsValid) {
    return <BillDetailView mode="public" detail={null} />;
  }

  if (billQuery.isPending) {
    return (
      <ResidentAsyncState
        variant="public"
        role="status"
        message="관리비 고지서를 불러오고 있어요"
      />
    );
  }

  if (billQuery.error) {
    return (
      <ResidentAsyncState
        variant="public"
        role="alert"
        message={<b>관리비 고지서를 불러오지 못했어요</b>}
        retryLabel="다시 시도"
        onRetry={() => void billQuery.refetch()}
      />
    );
  }

  // 앱 유도 CTA·열람 안내는 BillDetailView(public 모드)가 정본대로 렌더하므로
  // 셸의 기본 CTA 버튼은 끈다(중복 방지).
  return (
    <PublicTokenPageShell
      brand="관리비서"
      subtitle="공개 관리비 고지서"
      ctaLabel="관리비서 시작하기"
      showCta={false}
    >
      <BillDetailView mode="public" detail={billQuery.data ?? null} />
    </PublicTokenPageShell>
  );
}

export default function PublicSignedBillPage() {
  return (
    <Suspense
      fallback={
        <ResidentAsyncState
          variant="public"
          role="status"
          message="관리비 고지서를 불러오고 있어요"
        />
      }
    >
      <PublicSignedBillContent />
    </Suspense>
  );
}
