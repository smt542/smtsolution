"use client";

import { useRouter } from "next/navigation";

import type { Complaint } from "@/hooks/reactquery/complaints";

import styles from "./AsRail.module.css";
import { AS_STATUS_COLOR, AS_STATUS_LABEL, hhmm, mmdd } from "./constants";

interface AsReceptionCardProps {
  complaint: Complaint;
  nameOf: (id?: string | null) => string;
}

export function AsReceptionCard({ complaint, nameOf }: AsReceptionCardProps) {
  const router = useRouter();
  const resolution = complaint.resolutions[0];
  const unitLabel = `${complaint.unitDong ?? ""}${complaint.unitNo ?? ""}`;
  const location = [complaint.buildingName ?? "-", unitLabel]
    .filter(Boolean)
    .join(" ");

  return (
    <a
      className={styles.rnbCard}
      href="/staff/receipts"
      onClick={(event) => {
        event.preventDefault();
        router.push("/staff/receipts");
      }}
    >
      <div className={styles.rowSb}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>
          #{complaint.id} · {location}
        </div>
        <span
          className={styles.asStatus}
          data-c={AS_STATUS_COLOR[complaint.status]}
          style={{ color: AS_STATUS_COLOR[complaint.status] }}
        >
          {AS_STATUS_LABEL[complaint.status]}
        </span>
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}
      >
        <span className={styles.asTag}>{complaint.categoryLabel ?? "-"}</span>
        <span
          className="num"
          style={{ fontSize: 12, color: "var(--t3)", fontWeight: 600 }}
        >
          {hhmm(complaint.receivedAt)}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--t3)",
            fontWeight: 600,
            marginLeft: "auto",
          }}
        >
          {nameOf(complaint.assignedTo)}
        </span>
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--t2)",
          fontWeight: 600,
          marginTop: 8,
          lineHeight: 1.5,
          whiteSpace: "normal",
        }}
      >
        {complaint.content ?? complaint.title}
      </div>
      <div
        style={{ height: 1, background: "var(--line2)", margin: "10px 0 4px" }}
      />
      <div className={styles.rnbKv}>
        <span className={styles.k}>접수일 / 시행일</span>
        <span className={`${styles.v} num`}>
          {mmdd(complaint.receivedAt)} /{" "}
          {mmdd(complaint.completedAt ?? resolution?.resolvedAt)}
        </span>
      </div>
      <div className={styles.rnbKv}>
        <span className={styles.k}>접수시 전화</span>
        <span className={`${styles.v} num`}>{complaint.reporterPhone ?? "-"}</span>
      </div>
      <div className={styles.rnbKv}>
        <span className={styles.k}>담당자 / 접수</span>
        <span className={styles.v}>
          {nameOf(complaint.assignedTo)} / {nameOf(complaint.createdBy)}
        </span>
      </div>
      <div className={styles.rnbKv}>
        <span className={styles.k}>처리결과</span>
        <span className={styles.v}>{resolution?.resultContent ?? "-"}</span>
      </div>
    </a>
  );
}
