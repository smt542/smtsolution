"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";

import { PartnerListRow } from "../../../_components/PartnerListRow";
import { PartnerMobileHeader } from "../../../_components/PartnerMobileHeader";
import { PartnerPhoneLink } from "../../../_components/PartnerPhoneLink";
import type { Building, Unit, Vendor } from "./data";
import { buildingClasses as styles } from "./buildingClasses";

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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <b className={styles.rowValue}>{children}</b>
    </div>
  );
}

type PartnerBuildingWorkspaceProps = {
  buildingId: number | null;
  building: Building | null;
  units: Unit[];
  vendors: Vendor[];
};

export default function PartnerBuildingWorkspace({
  buildingId,
  building,
  units,
  vendors,
}: PartnerBuildingWorkspaceProps) {
  const [tab, setTab] = useState<"info" | "ten">("info");

  const header = (title: string) => (
    <PartnerMobileHeader
      title={title}
      backHref="/partner/mobile-inquiry"
      action={
        <Link
          href={buildingId != null ? `/partner/mobile-meter?id=${buildingId}` : "/partner/mobile-meter"}
          className={styles.meterBtn}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 18a8 8 0 1 1 16 0" />
            <path d="M12 14l3-3" />
          </svg>
          검침 자료
        </Link>
      }
    />
  );

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
              <Row label="건물 유형">{building.building_type ?? "-"}</Row>
              <Row label="건물 주소">{building.address ?? "-"}</Row>
              <Row label="공동현관">{building.entrance_password ?? "-"}</Row>
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
                      {v.phone && <PartnerPhoneLink phone={v.phone} />}
                    </div>
                    {v.memo && <div className={styles.vendMemo}>{v.memo}</div>}
                  </div>
                ))
              )}
            </div>

            <div className={styles.sectionTitle}>건물주 정보</div>
            <div className={styles.sec}>
              <Row label="건물주명">{building.owner_name ?? "-"}</Row>
              <div className={styles.row}>
                <span className={styles.rowLabel}>전화번호</span>
                <b className={styles.rowValue}>
                  {building.owner_phone ? <PartnerPhoneLink phone={building.owner_phone} /> : "-"}
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
                <PartnerListRow key={u.unit_id} href={`/partner/mobile-tenant?id=${u.unit_id}`} chevron>
                  <span className={styles.uho}>{unitLabel(u.dong, u.unit_no)}</span>
                  {u.tenant_name ? <span className={styles.unm}>{u.tenant_name}</span> : <span className={styles.uvac}>공실</span>}
                  <span className={styles.uspacer} />
                </PartnerListRow>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
