"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import BillDetailView from "@/app/(resident)/_components/BillDetailView";
import ResidentAsyncState from "@/app/(resident)/_components/ResidentAsyncState";
import ResidentScreenFrame from "@/app/(resident)/_components/ResidentScreenFrame";
import { usePublicBillByToken } from "@/hooks/reactquery/residentBilling";

import styles from "./public.module.css";

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
    <ResidentScreenFrame
      variant="public"
      header={
        <>
          <span className={styles.brand}>관리비서</span>
          <span>공개 관리비 고지서</span>
        </>
      }
    >
      <BillDetailView mode="public" detail={billQuery.data ?? null} />
      {valid ? (
        <Link className={styles.cta} href="/resident/login">
          관리비서 시작하기
        </Link>
      ) : null}
    </ResidentScreenFrame>
  );
}
