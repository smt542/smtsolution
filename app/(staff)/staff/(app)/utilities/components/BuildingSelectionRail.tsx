"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { CustomDropdown } from "@/components/common/CustomDropdown";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  useMeterHistory,
  type UtilityType,
  type UtilityUnitRow,
} from "@/hooks/reactquery/utilities";
import { SearchIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";

interface BuildingSelectionRailProps {
  buildings: Building[];
  buildingId: number | null;
  selectedRow: UtilityUnitRow | null;
  utilityType: UtilityType;
  period: string;
  year: number;
  month: number;
  customerNumberCounts?: Record<number, number>;
  disabled?: boolean;
  loading?: boolean;
  onBuildingChange: (buildingId: number) => void;
  onPeriodChange: (year: number, month: number) => void;
}

const YEARS = [2026, 2025, 2024];

export function BuildingSelectionRail({
  buildings,
  buildingId,
  selectedRow,
  utilityType,
  period,
  year,
  month,
  customerNumberCounts = {},
  disabled = false,
  loading = false,
  onBuildingChange,
  onPeriodChange,
}: BuildingSelectionRailProps) {
  const [query, setQuery] = useState("");
  const historyQuery = useMeterHistory(selectedRow?.unitId ?? null, utilityType, period);
  const filteredBuildings = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko-KR");
    if (!keyword) return buildings;
    return buildings.filter((building) =>
      [building.code, building.name, building.address]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("ko-KR").includes(keyword)),
    );
  }, [buildings, query]);

  return (
    <aside className={`flex min-h-0 w-full shrink-0 flex-col gap-4 transition-opacity min-[1101px]:h-[650px] min-[1101px]:w-[322px] ${disabled ? "pointer-events-none opacity-45" : ""}`}>
      <select
        aria-label="건물 선택"
        value={buildingId ?? ""}
        disabled={disabled}
        onChange={(event) => event.target.value && onBuildingChange(Number(event.target.value))}
        className="sr-only"
      >
        <option value="">건물을 선택해 주세요</option>
        {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
      </select>
      <section className="flex h-[433px] min-h-[190px] flex-none flex-col overflow-hidden rounded-[16px] bg-white shadow-card min-[1101px]:h-auto min-[1101px]:flex-1">
        <div className="flex flex-col items-stretch gap-[9px] border-b border-line2 px-[18px] py-[15px]">
          <div className="flex h-8 items-center gap-2">
            <h2 className="mr-auto whitespace-nowrap text-[15px] font-extrabold text-t1">전체 건물</h2>
            <div className="[&_.uc-dd-menu]:min-w-[104px]">
              <CustomDropdown
                ariaLabel="부과 연도"
                value={String(year)}
                disabled={disabled}
                options={YEARS.map((value) => ({ value: String(value), label: `${value}년` }))}
                compact
                onChange={(value) => onPeriodChange(Number(value), month)}
              />
            </div>
            <div className="[&_.uc-dd-menu]:min-w-[112px]">
              <CustomDropdown
                ariaLabel="부과 월"
                value={String(month)}
                disabled={disabled}
                options={Array.from({ length: 12 }, (_, index) => ({
                  value: String(index + 1),
                  label: `${index + 1}월분`,
                }))}
                compact
                onChange={(value) => onPeriodChange(year, Number(value))}
              />
            </div>
          </div>

          <label className="relative block">
            <span className="sr-only">건물명·주소 검색</span>
            <SearchIcon className="pointer-events-none absolute left-[11px] top-1/2 size-[15px] -translate-y-1/2 text-t3" />
            <input
              aria-label="건물명·주소 검색"
              value={query}
              disabled={disabled}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="건물명·주소 검색"
              className="h-[34px] w-full rounded-[9px] border border-line bg-white pl-[31px] pr-[11px] text-[13px] font-semibold text-t1 outline-none placeholder:text-t4 focus:border-blue"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse text-[13.5px]">
            <thead className="sticky top-0 z-10 bg-[#FBFCFD] text-[12px] font-bold text-t3">
              <tr className="h-[37px] border-b border-line">
                <th className="w-[70px] px-[11px] text-left">코드</th>
                <th className="w-[118px] px-[11px] text-left">건물명</th>
                <th className="px-[11px] text-left">주소</th>
                <th className="w-[52px] px-[11px] text-right">수도</th>
              </tr>
            </thead>
            <tbody>
              {filteredBuildings.map((building) => {
                const selected = building.id === buildingId;
                return (
                  <tr
                    key={building.id}
                    onClick={() => onBuildingChange(building.id)}
                    className={`h-[41px] cursor-pointer border-b border-line2 transition-colors ${
                      selected ? "bg-blue-t text-t1" : "text-t1 hover:bg-blue-t2"
                    }`}
                  >
                    <td className="truncate px-[11px] font-medium">{building.code || "-"}</td>
                    <td className="truncate px-[11px] font-bold">{building.name}</td>
                    <td className="truncate px-[11px] font-medium">{building.address || "-"}</td>
                    <td className="num px-[11px] text-right font-bold">{customerNumberCounts[building.id] ?? 0}</td>
                  </tr>
                );
              })}
              {!loading && filteredBuildings.length === 0 && (
                <tr><td colSpan={4} className="h-32 text-center text-[13px] text-t3">조건에 맞는 건물이 없어요.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex min-h-[250px] flex-1 basis-[52%] flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
        <div className="flex min-h-[49px] shrink-0 items-center border-b border-line2 px-[18px] py-[15px]">
          <h2 className="text-[15px] font-extrabold text-t1">최근 6개월 이력</h2>
        </div>
        {!selectedRow ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 pb-5 text-center">
            <Image src="/figma-assets/utility-history-empty.svg" alt="" width={40} height={40} />
            <p className="mt-3 text-[15px] font-semibold tracking-[-0.02em] text-t1">고객번호를 선택해 주세요</p>
            <p className="mt-1 text-[13px] leading-[1.55] text-t3">선택한 고객번호의<br />최근 6개월 이력이 표시돼요</p>
          </div>
        ) : historyQuery.isLoading ? (
          <div role="status" aria-label="최근 6개월 이력 불러오는 중" className="flex flex-1 items-center justify-center text-[12px] text-t3">이력을 불러오는 중입니다.</div>
        ) : historyQuery.isError ? (
          <div role="alert" className="flex flex-1 items-center justify-center text-[12px] text-red">이력을 불러오지 못했습니다.</div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="border-b border-line2 px-4 py-3">
              <p className="text-[12px] font-bold text-t1">{selectedRow.customerNumber || "고객번호 미등록"}</p>
              <p className="mt-0.5 text-[11px] text-t3">{selectedRow.unitNo} · {selectedRow.tenantName || "공실"}</p>
            </div>
            <table className="w-full text-[14px]">
              <thead className="sticky top-0 bg-[#FBFCFD] text-t3">
                <tr className="border-b border-line"><th className="px-4 py-[9px] text-left font-bold">일시</th><th className="px-4 py-[9px] text-right font-bold">부과액</th><th className="px-4 py-[9px] text-right font-bold">단가</th></tr>
              </thead>
              <tbody>
                {(historyQuery.data ?? []).map((item) => (
                  <tr key={item.period} className="border-b border-line2 font-semibold text-t1 hover:bg-[#F7F9FA]">
                    <td className="px-4 py-[9px]">{item.period.slice(0, 7)}</td>
                    <td className="num px-4 py-[9px] text-right font-bold">{formatNumber(item.charge)}</td>
                    <td className="num px-4 py-[9px] text-right font-medium">{formatNumber(item.unitPrice)}</td>
                  </tr>
                ))}
                {(historyQuery.data ?? []).length === 0 && (
                  <tr><td colSpan={3} className="h-28 text-center text-t3">최근 이력이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </aside>
  );
}
