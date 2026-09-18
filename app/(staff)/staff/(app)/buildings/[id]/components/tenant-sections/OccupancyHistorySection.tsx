"use client";
import React from "react";
import { DataTable } from "@/components/common";
import { MaskedPhone } from "@/components/common/MaskedPhone";
import type { OccupancyHistory } from "@/hooks/reactquery/occupancyHistory";

export function OccupancyHistorySection({ history }: { history: OccupancyHistory[] }) {
  const rows = history.map((item) => ({
    moveOutDate: item.moveOutDate ?? "-",
    tenantName: item.tenantName ?? "-",
    homePhone: item.phone3 ? (
      <MaskedPhone value={item.phone3} kind="phone" alreadyMasked reveal={{ targetKind: "occupancy_history", targetId: item.id, field: "phone3" }} />
    ) : "-",
    primaryPhone: item.phone ? (
      <MaskedPhone value={item.phone} kind="phone" alreadyMasked reveal={{ targetKind: "occupancy_history", targetId: item.id, field: "phone" }} />
    ) : "-",
    secondaryPhone: item.phone2 ? (
      <MaskedPhone value={item.phone2} kind="phone" alreadyMasked reveal={{ targetKind: "occupancy_history", targetId: item.id, field: "phone2" }} />
    ) : "-",
    moveInDate: item.moveInDate ?? "-",
  }));

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-4 text-lg font-extrabold text-t1">전출정보</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-t4">전출자 이력이 없습니다.</p>
      ) : (
        <DataTable
          columns={[
            { key: "moveOutDate", label: "이사일" },
            { key: "tenantName", label: "이름" },
            { key: "homePhone", label: "집전화" },
            { key: "primaryPhone", label: "전화(주)" },
            { key: "secondaryPhone", label: "전화(부)" },
            { key: "moveInDate", label: "입주일" },
          ]}
          rows={rows}
        />
      )}
    </section>
  );
}
