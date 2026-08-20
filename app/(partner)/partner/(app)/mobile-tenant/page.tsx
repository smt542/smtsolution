"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import styles from "./mobile-tenant.module.css";

type Occ = {
  unit_id: number;
  building_id: number;
  building_name: string;
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  payer_name: string | null;
  phone: string | null;
  resident_count: number | null;
  vehicle_no: string | null;
  move_in_date: string | null;
  status: string;
};

function unitLabel(dong: string | null, unitNo: string) {
  return `${dong ? `${dong} ` : ""}${unitNo}`;
}
function fmtDate(iso: string | null) {
  return iso ? iso.slice(0, 10).replaceAll("-", ".") : "";
}
function telHref(v: string) {
  return `tel:${v.replace(/[^0-9]/g, "")}`;
}

function TenantDetailInner() {
  const sp = useSearchParams();
  const idStr = sp.get("id");
  const unitId = idStr ? Number(idStr) : NaN;
  const [occ, setOcc] = useState<Occ | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!Number.isFinite(unitId)) {
        setLoading(false);
        return;
      }
      const { data } = await createClient().rpc("partner_get_occupancy", { p_unit_id: unitId });
      if (!alive) return;
      setOcc((Array.isArray(data) ? data[0] : data) ?? null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [unitId]);

  const backHref = occ ? `/partner/mobile-building?id=${occ.building_id}` : "/partner/mobile-inquiry";

  const header = (
    <div className={styles.header}>
      <Link href={backHref} className={styles.back} aria-label="뒤로">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <div className={styles.titleWrap}>
        <div className={styles.title}>
          {occ ? `${unitLabel(occ.dong, occ.unit_no)}${occ.tenant_name ? ` · ${occ.tenant_name}` : ""}` : "입주자"}
        </div>
        {occ && <div className={styles.sub}>{occ.building_name}</div>}
      </div>
      {occ && (
        <Link href="/partner/mobile-ms-new" className={styles.msBtn}>
          이사정산 등록
        </Link>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className={styles.root}>
        {header}
        <div className={styles.none}>불러오는 중…</div>
      </div>
    );
  }
  if (!occ) {
    return (
      <div className={styles.root}>
        {header}
        <div className={styles.none}>세대 정보를 찾을 수 없어요</div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {header}
      <div className={styles.scroll}>
        <div className={styles.pad}>
          <div className={styles.sectionTitle}>입주자 정보</div>
          <div className={styles.sec}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>건물명</span>
              <b className={styles.rowValue}>{occ.building_name}</b>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>호수</span>
              <b className={styles.rowValue}>{unitLabel(occ.dong, occ.unit_no)}</b>
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>입주자명</span>
              {occ.tenant_name ? <b className={styles.rowValue}>{occ.tenant_name}</b> : <span className={styles.uvac}>공실</span>}
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>입주일</span>
              <b className={styles.rowValue}>{fmtDate(occ.move_in_date) || "—"}</b>
            </div>
          </div>

          <div className={styles.sectionTitle}>연락처</div>
          <div className={styles.sec}>
            <div className={styles.row}>
              <span className={styles.rowLabel}>전화번호</span>
              {occ.phone ? (
                <a className={styles.tel} href={telHref(occ.phone)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1.1 1A16 16 0 0 1 4 5.1 1 1 0 0 1 5 4z" />
                  </svg>
                  {occ.phone}
                </a>
              ) : (
                <span className={styles.muted}>등록된 연락처가 없어요</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PartnerTenantPage() {
  return (
    <Suspense fallback={<div className={styles.root} />}>
      <TenantDetailInner />
    </Suspense>
  );
}
