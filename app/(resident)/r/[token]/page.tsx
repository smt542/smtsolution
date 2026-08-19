"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import BillDetailView from "@/app/(resident)/_components/BillDetailView";
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
      <div className={styles.center} role="status">
        관리비 고지서를 불러오고 있어요
      </div>
    );
  }

  if (billQuery.error) {
    return (
      <div className={styles.center} role="alert">
        <b>관리비 고지서를 불러오지 못했어요</b>
        <button type="button" onClick={() => void billQuery.refetch()}>
          다시 시도
        </button>
      </div>
    );
  }

  const valid = billQuery.data && !billQuery.data.isExpired;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>관리비서</span>
        <span>공개 관리비 고지서</span>
      </header>
      <main className={styles.scroll}>
        <BillDetailView mode="public" detail={billQuery.data ?? null} />
        {valid ? (
          <Link className={styles.cta} href="/resident/login">
            관리비서 시작하기
          </Link>
        ) : null}
      </main>
    </div>
  );
}
