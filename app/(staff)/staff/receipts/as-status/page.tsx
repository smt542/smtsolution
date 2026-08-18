"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, Input, Select, Spinner } from "@/components/common";
import { useAsCategories } from "@/hooks/reactquery/asCategories";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useComplaints, type Complaint } from "@/hooks/reactquery/complaints";
import { hasModule } from "@/lib/auth/permissions";
import {
  COMPLAINT_STATUS_LABEL,
  COMPLAINT_STATUS_STYLE,
  endOfDayIso,
  formatComplaintDate,
  formatUnitLabel,
  startOfDayIso,
} from "../constants";

function setMonthRange(
  month: string,
  setFrom: (value: string) => void,
  setTo: (value: string) => void,
) {
  if (!month) {
    setFrom("");
    setTo("");
    return;
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  setFrom(`${month}-01`);
  setTo(`${month}-${String(lastDay).padStart(2, "0")}`);
}

export function asStatusExportUrl({
  buildingId,
  categoryId,
  receivedFrom,
  receivedTo,
}: {
  buildingId: string;
  categoryId: string;
  receivedFrom: string;
  receivedTo: string;
}) {
  const params = new URLSearchParams();
  if (buildingId) params.set("buildingId", buildingId);
  if (categoryId) params.set("categoryId", categoryId);
  if (receivedFrom) params.set("receivedFrom", receivedFrom);
  if (receivedTo) params.set("receivedTo", receivedTo);
  const query = params.toString();
  return `/api/receipts/as-status/export${query ? `?${query}` : ""}`;
}

function resultText(complaint: Complaint) {
  return complaint.resolutions[0]?.resultContent || "처리이력 없음";
}

function AsStatusWorkspace() {
  const router = useRouter();
  const { data: buildings = [], isLoading: isBuildingsLoading } = useBuildings();
  const { data: categories = [], isLoading: isCategoriesLoading } = useAsCategories();
  const [buildingId, setBuildingId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [month, setMonth] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [receivedTo, setReceivedTo] = useState("");
  const {
    data: complaints = [],
    isLoading,
    isError,
    refetch,
  } = useComplaints({
    buildingId: Number(buildingId) || undefined,
    categoryId: Number(categoryId) || undefined,
    receivedFrom: startOfDayIso(receivedFrom),
    receivedTo: endOfDayIso(receivedTo),
  });

  const organizationBuildings = useMemo(
    () => buildings.slice().sort((a, b) => a.name.localeCompare(b.name, "ko-KR")),
    [buildings],
  );

  const downloadExcel = () => {
    const anchor = document.createElement("a");
    anchor.href = asStatusExportUrl({ buildingId, categoryId, receivedFrom, receivedTo });
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const openReceiptUnit = (complaint: Complaint) => {
    if (!complaint.unitNo) return;
    const params = new URLSearchParams({
      buildingId: String(complaint.buildingId),
      unit: formatUnitLabel({ unitNo: complaint.unitNo, dong: complaint.unitDong }),
    });
    const target = `/staff/receipts?${params.toString()}`;
    if (window.opener && !window.opener.closed) {
      window.opener.location.assign(target);
      window.opener.focus();
      window.close();
      return;
    }
    router.push(target);
  };

  const resetFilters = () => {
    setBuildingId("");
    setCategoryId("");
    setMonth("");
    setReceivedFrom("");
    setReceivedTo("");
  };

  return (
    <main className="min-h-screen bg-bg p-5 print:bg-white print:p-0">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold text-t3 print:hidden">수납관리·민원접수</p>
            <h1 className="text-2xl font-extrabold text-t1">AS접수현황</h1>
            <p className="mt-1 text-sm text-t3">
              건물·날짜별 AS 접수와 처리결과를 조회합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button type="button" variant="ghost" onClick={() => window.print()}>
              건물별 월별 출력
            </Button>
            <Button type="button" onClick={downloadExcel} disabled={isLoading || complaints.length === 0}>
              엑셀 다운로드
            </Button>
          </div>
        </header>

        <section aria-label="AS접수현황 필터" className="rounded-2xl border border-line bg-surface p-4 shadow-card print:hidden">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[200px_170px_150px_160px_160px_auto]">
            <Select
              aria-label="AS 건물 필터"
              value={buildingId}
              disabled={isBuildingsLoading}
              onChange={(event) => setBuildingId(event.target.value)}
              options={[
                { value: "", label: "전체 건물" },
                ...organizationBuildings.map((building) => ({
                  value: String(building.id),
                  label: building.name,
                })),
              ]}
            />
            <Select
              aria-label="AS 구분 필터"
              value={categoryId}
              disabled={isCategoriesLoading}
              onChange={(event) => setCategoryId(event.target.value)}
              options={[
                { value: "", label: "전체 AS 구분" },
                ...categories.map((category) => ({
                  value: String(category.id),
                  label: category.label,
                })),
              ]}
            />
            <Input
              aria-label="AS 월별 조회"
              type="month"
              value={month}
              onChange={(event) => {
                const value = event.target.value;
                setMonth(value);
                setMonthRange(value, setReceivedFrom, setReceivedTo);
              }}
            />
            <Input
              aria-label="AS 접수 시작일"
              type="date"
              value={receivedFrom}
              max={receivedTo || undefined}
              onChange={(event) => {
                setMonth("");
                setReceivedFrom(event.target.value);
              }}
            />
            <Input
              aria-label="AS 접수 종료일"
              type="date"
              value={receivedTo}
              min={receivedFrom || undefined}
              onChange={(event) => {
                setMonth("");
                setReceivedTo(event.target.value);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              disabled={!buildingId && !categoryId && !receivedFrom && !receivedTo}
              onClick={resetFilters}
            >
              초기화
            </Button>
          </div>
        </section>

        <div className="hidden border-b-2 border-black pb-3 print:block">
          <p className="text-sm font-bold">
            {organizationBuildings.find((building) => building.id === Number(buildingId))?.name ?? "전체 건물"}
            {receivedFrom || receivedTo ? ` · ${receivedFrom || "처음"} ~ ${receivedTo || "현재"}` : ""}
          </p>
        </div>

        {isLoading ? (
          <Spinner />
        ) : isError ? (
          <div className="rounded-2xl border border-red/20 bg-red-t p-8 text-center print:hidden">
            <p className="text-sm font-semibold text-red">AS 접수현황을 불러오지 못했습니다. 다시 시도해 주세요.</p>
            <Button type="button" variant="ghost" className="mt-4" onClick={() => void refetch()}>
              다시 시도
            </Button>
          </div>
        ) : complaints.length === 0 ? (
          <EmptyState message="조건에 맞는 AS 접수가 없습니다" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card print:overflow-visible print:rounded-none print:border-black print:shadow-none">
            <table className="w-full min-w-[1050px] text-sm print:min-w-0 print:text-[10px]">
              <thead>
                <tr className="border-b border-line bg-bg text-left text-xs font-bold text-t3 print:border-black print:bg-white print:text-black">
                  <th className="px-4 py-3">접수일</th>
                  <th className="px-4 py-3">건물명</th>
                  <th className="px-4 py-3">호실명</th>
                  <th className="px-4 py-3">접수내용</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">처리결과</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((complaint) => (
                  <tr key={complaint.id} className="border-b border-line last:border-0 print:border-slate-400">
                    <td className="whitespace-nowrap px-4 py-4 print:px-2 print:py-2">{formatComplaintDate(complaint.receivedAt)}</td>
                    <td className="px-4 py-4 font-bold print:px-2 print:py-2">{complaint.buildingName ?? "-"}</td>
                    <td
                      className={`px-4 py-4 print:px-2 print:py-2 ${complaint.unitNo ? "cursor-pointer font-bold text-blue underline decoration-dotted underline-offset-4 print:text-black print:no-underline" : "text-t4"}`}
                      title={complaint.unitNo ? "더블클릭하면 해당 호실 수납현황으로 이동합니다." : undefined}
                      onDoubleClick={() => openReceiptUnit(complaint)}
                    >
                      {formatUnitLabel({ unitNo: complaint.unitNo, dong: complaint.unitDong })}
                    </td>
                    <td className="max-w-md px-4 py-4 print:px-2 print:py-2">
                      <p className="font-bold">{complaint.title}</p>
                      <p className="mt-1 text-xs text-t3 print:text-[9px] print:text-black">{complaint.content || "내용 없음"}</p>
                    </td>
                    <td className="px-4 py-4 print:px-2 print:py-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold print:p-0 print:text-black ${COMPLAINT_STATUS_STYLE[complaint.status]}`}>
                        {COMPLAINT_STATUS_LABEL[complaint.status]}
                      </span>
                    </td>
                    <td className="max-w-sm px-4 py-4 text-t2 print:px-2 print:py-2 print:text-black">{resultText(complaint)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

export default function AsStatusPage() {
  const { data: me, isLoading } = useMe();
  if (isLoading || me === undefined) return <Spinner />;
  if (!me || !hasModule(me, "complaints")) {
    return <EmptyState message="민원·AS 관리 권한이 없습니다" />;
  }
  return <AsStatusWorkspace />;
}
