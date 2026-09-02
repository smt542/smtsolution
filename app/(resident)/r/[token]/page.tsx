"use client";

import { useParams } from "next/navigation";

import BillDetailView from "@/app/(resident)/_components/BillDetailView";
import PublicTokenPageShell from "@/app/(resident)/_components/PublicTokenPageShell";
import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";
import { usePublicBillByToken } from "@/hooks/reactquery/residentBilling";

export default function PublicBillPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const billQuery = usePublicBillByToken(token);

  if (!token) {
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

  const valid = billQuery.data && !billQuery.data.isExpired;

  return (
    <PublicTokenPageShell
      brand="관리비서"
      subtitle="공개 관리비 고지서"
      ctaLabel="관리비서 시작하기"
      showCta={Boolean(valid)}
    >
      <BillDetailView mode="public" detail={billQuery.data ?? null} />
    </PublicTokenPageShell>
  );
}
