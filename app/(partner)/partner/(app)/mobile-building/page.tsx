"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import styles from "./mobile-building.module.css";

type Building = { id: number; code: string; name: string; address: string | null; memo: string | null };
type Unit = {
  unit_id: number;
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  phone: string | null;
  move_in_date: string | null;
  status: string;
};

function unitLabel(dong: string | null, unitNo: string) {
  return `${dong ? `${dong} ` : ""}${unitNo}`;
}

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

function BuildingDetailInner() {
  const sp = useSearchParams();
  const idStr = sp.get("id");
  const buildingId = idStr ? Number(idStr) : NaN;
  const [building, setBuilding] = useState<Building | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"info" | "ten">("info");

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!Number.isFinite(buildingId)) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const [{ data: b }, { data: u }] = await Promise.all([
        supabase.rpc("partner_get_building", { p_building_id: buildingId }),
        supabase.rpc("partner_list_units", { p_building_id: buildingId }),
      ]);
      if (!alive) return;
      setBuilding((Array.isArray(b) ? b[0] : b) ?? null);
      setUnits(Array.isArray(u) ? (u as Unit[]) : []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [buildingId]);

  const header = (title: string) => (
    <div className={styles.header}>
      <Link href="/partner/mobile-inquiry" className={styles.back} aria-label="뒤로">
        <BackIcon />
      </Link>
      <div className={styles.title}>{title}</div>
      <Link href="/partner/mobile-meter" className={styles.meterBtn}>검침 자료</Link>
    </div>
  );

  if (loading) {
    return (
      <div className={styles.root}>
        {header("건물")}
        <div className={styles.none}>불러오는 중…</div>
      </div>
    );
  }
  if (!building) {
    return (
      <div className={styles.root}>
        {header("건물")}
        <div className={styles.none}>건물 정보를 찾을 수 없어요</div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {header(building.name)}
      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${tab === "info" ? styles.tabOn : ""}`} onClick={() => setTab("info")}>
          건물 정보
        </button>
        <button type="button" className={`${styles.tab} ${tab === "ten" ? styles.tabOn : ""}`} onClick={() => setTab("ten")}>
          입주자 정보 <span className={styles.count}>{units.length}</span>
        </button>
      </div>

      <div className={styles.scroll}>
        {tab === "info" ? (
          <div className={styles.pad}>
            <div className={styles.sectionTitle}>기본 정보</div>
            <div className={styles.sec}>
              <div className={styles.row}>
                <span className={styles.rowLabel}>건물 코드</span>
                <b className={styles.rowValue}>{building.code}</b>
              </div>
              <div className={styles.row}>
                <span className={styles.rowLabel}>건물명</span>
                <b className={styles.rowValue}>{building.name}</b>
              </div>
              <div className={styles.row}>
                <span className={styles.rowLabel}>건물 주소</span>
                <b className={styles.rowValue}>{building.address ?? "-"}</b>
              </div>
              {building.memo && (
                <div className={styles.row}>
                  <span className={styles.rowLabel}>메모</span>
                  <b className={styles.rowValue}>{building.memo}</b>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.pad}>
            {units.length === 0 ? (
              <div className={styles.none}>세대 정보가 없어요</div>
            ) : (
              units.map((u) => (
                <Link key={u.unit_id} href={`/partner/mobile-tenant?id=${u.unit_id}`} className={styles.ucell}>
                  <span className={styles.uho}>{unitLabel(u.dong, u.unit_no)}</span>
                  {u.tenant_name ? <span className={styles.unm}>{u.tenant_name}</span> : <span className={styles.uvac}>공실</span>}
                  <span className={styles.uspacer} />
                  <svg className={styles.uchev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PartnerBuildingPage() {
  return (
    <Suspense fallback={<div className={styles.root} />}>
      <BuildingDetailInner />
    </Suspense>
  );
}
