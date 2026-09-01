"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import styles from "./mobile-building.module.css";

type Building = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  memo: string | null;
  building_type: string | null;
  entrance_password: string | null;
  owner_name: string | null;
  owner_phone: string | null;
};
type Unit = {
  unit_id: number;
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  phone: string | null;
  move_in_date: string | null;
  status: string;
};
type Vendor = {
  id: number;
  vendor_type: string;
  name: string;
  phone: string | null;
  memo: string | null;
};

const VENDOR_LABEL: Record<string, string> = {
  elevator: "승강기",
  fire: "소방",
  electric: "전기안전",
  septic: "정화조",
  etc: "기타",
};

function unitLabel(dong: string | null, unitNo: string) {
  return `${dong ? `${dong} ` : ""}${unitNo}`;
}
function telHref(v: string) {
  return `tel:${v.replace(/[^0-9]/g, "")}`;
}

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1.1 1A16 16 0 0 1 4 5.1 1 1 0 0 1 5 4z" />
  </svg>
);

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <b className={styles.rowValue}>{children}</b>
    </div>
  );
}

function BuildingDetailInner() {
  const sp = useSearchParams();
  const idStr = sp.get("id");
  const buildingId = idStr ? Number(idStr) : NaN;
  const [building, setBuilding] = useState<Building | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
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
      const [{ data: b }, { data: u }, { data: v }] = await Promise.all([
        supabase.rpc("partner_get_building", { p_building_id: buildingId }),
        supabase.rpc("partner_list_units", { p_building_id: buildingId }),
        supabase.rpc("partner_list_building_vendors", { p_building_id: buildingId }),
      ]);
      if (!alive) return;
      setBuilding((Array.isArray(b) ? b[0] : b) ?? null);
      setUnits(Array.isArray(u) ? (u as Unit[]) : []);
      setVendors(Array.isArray(v) ? (v as Vendor[]) : []);
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
      <Link
        href={Number.isFinite(buildingId) ? `/partner/mobile-meter?id=${buildingId}` : "/partner/mobile-meter"}
        className={styles.meterBtn}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 18a8 8 0 1 1 16 0" />
          <path d="M12 14l3-3" />
        </svg>
        검침 자료
      </Link>
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
              <Row label="건물 코드">{building.code}</Row>
              <Row label="건물명">{building.name}</Row>
              <Row label="건물 유형">{building.building_type ?? "—"}</Row>
              <Row label="건물 주소">{building.address ?? "—"}</Row>
              <Row label="공동현관">{building.entrance_password ?? "—"}</Row>
              {building.memo && <Row label="메모">{building.memo}</Row>}
            </div>

            <div className={styles.sectionTitle}>업체 정보</div>
            <div className={styles.sec}>
              {vendors.length === 0 ? (
                <div className={styles.vendEmpty}>등록된 업체가 없어요</div>
              ) : (
                vendors.map((v) => (
                  <div key={v.id} className={styles.vend}>
                    <div className={styles.vendType}>{VENDOR_LABEL[v.vendor_type] ?? v.vendor_type}</div>
                    <div className={styles.vendBody}>
                      <span className={styles.vendName}>{v.name}</span>
                      {v.phone && (
                        <a className={styles.tel} href={telHref(v.phone)}>
                          <PhoneIcon />
                          {v.phone}
                        </a>
                      )}
                    </div>
                    {v.memo && <div className={styles.vendMemo}>{v.memo}</div>}
                  </div>
                ))
              )}
            </div>

            <div className={styles.sectionTitle}>건물주 정보</div>
            <div className={styles.sec}>
              <Row label="건물주명">{building.owner_name ?? "—"}</Row>
              <div className={styles.row}>
                <span className={styles.rowLabel}>전화번호</span>
                <b className={styles.rowValue}>
                  {building.owner_phone ? (
                    <a className={styles.tel} href={telHref(building.owner_phone)}>
                      <PhoneIcon />
                      {building.owner_phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </b>
              </div>
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
