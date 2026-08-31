"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  useMeterHistory,
  type UtilityType,
  type UtilityUnitRow,
} from "@/hooks/reactquery/utilities";
import { ChevronDownIcon, SearchIcon } from "@/components/icons";
import { formatNumber, formatWon } from "@/lib/format";

interface BuildingSelectionRailProps {
  buildings: Building[];
  buildingId: number | null;
  selectedRow: UtilityUnitRow | null;
  utilityType: UtilityType;
  period: string;
  year: number;
  month: number;
  loading?: boolean;
  onBuildingChange: (buildingId: number) => void;
  onPeriodChange: (year: number, month: number) => void;
}

const YEARS = Array.from({ length: 7 }, (_, index) => 2023 + index);

function PeriodSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (value: number) => void;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-8 appearance-none rounded-lg border border-line bg-white py-0 pl-3 pr-8 text-[12px] font-semibold text-t1 outline-none focus:border-teal"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-t3" />
    </label>
  );
}

export function BuildingSelectionRail({
  buildings,
  buildingId,
  selectedRow,
  utilityType,
  period,
  year,
  month,
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
    <aside className="flex min-h-0 w-full shrink-0 flex-col gap-4 xl:w-[322px]">
      <select
        aria-label="건물 선택"
        value={buildingId ?? ""}
        onChange={(event) => event.target.value && onBuildingChange(Number(event.target.value))}
        className="sr-only"
      >
        <option value="">건물을 선택해 주세요</option>
        {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
      </select>
      <section className="flex h-[433px] min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <h2 className="text-[13px] font-extrabold text-t1">전체 건물</h2>
          <div className="flex gap-1.5">
            <PeriodSelect
              label="부과 연도"
              value={year}
              options={YEARS.map((value) => ({ value, label: `${value}년` }))}
              onChange={(value) => onPeriodChange(value, month)}
            />
            <PeriodSelect
              label="부과 월"
              value={month}
              options={Array.from({ length: 12 }, (_, index) => ({
                value: index + 1,
                label: `${index + 1}월분`,
              }))}
              onChange={(value) => onPeriodChange(year, value)}
            />
          </div>
        </div>

        <label className="relative mx-4 mb-3 block">
          <span className="sr-only">건물 검색</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-t3" />
          <input
            aria-label="건물 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="건물명, 코드, 주소 검색"
            className="h-8 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-[12px] text-t1 outline-none placeholder:text-t4 focus:border-teal"
          />
        </label>

        <div className="min-h-0 flex-1 overflow-auto border-t border-line2">
          <table className="w-full table-fixed border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-[#FBFCFD] text-t3">
              <tr className="h-8 border-b border-line2">
                <th className="w-[54px] px-2 text-left font-semibold">코드</th>
                <th className="w-[76px] px-2 text-left font-semibold">건물명</th>
                <th className="px-2 text-left font-semibold">주소</th>
                <th className="w-[42px] px-2 text-center font-semibold">수도</th>
              </tr>
            </thead>
            <tbody>
              {filteredBuildings.map((building) => {
                const selected = building.id === buildingId;
                return (
                  <tr
                    key={building.id}
                    onClick={() => onBuildingChange(building.id)}
                    className={`h-[42px] cursor-pointer border-b border-line2 transition-colors ${
                      selected ? "bg-[#E2F5F1] text-teal" : "text-t2 hover:bg-bg"
                    }`}
                  >
                    <td className="truncate px-2 font-semibold">{building.code || "-"}</td>
                    <td className="truncate px-2 font-bold">{building.name}</td>
                    <td className="truncate px-2 text-t3">{building.address || "-"}</td>
                    <td className="px-2 text-center font-bold">{selected ? "선택" : "-"}</td>
                  </tr>
                );
              })}
              {!loading && filteredBuildings.length === 0 && (
                <tr><td colSpan={4} className="h-32 text-center text-[12px] text-t3">검색 결과가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex min-h-[250px] flex-1 flex-col overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex h-12 shrink-0 items-center border-b border-line2 px-4">
          <h2 className="text-[13px] font-extrabold text-t1">최근 6개월 이력</h2>
        </div>
        {!selectedRow ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 pb-5 text-center">
            <Image src="/figma-assets/utility-history-empty.svg" alt="" width={40} height={40} />
            <p className="mt-3 text-[12.5px] font-bold text-t2">고객번호를 선택해 주세요</p>
            <p className="mt-1 text-[11px] leading-4 text-t3">선택한 고객번호의 최근 6개월 이력이 표시돼요.</p>
          </div>
        ) : historyQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center text-[12px] text-t3">이력을 불러오는 중입니다.</div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="border-b border-line2 px-4 py-3">
              <p className="text-[12px] font-bold text-t1">{selectedRow.customerNumber || "고객번호 미등록"}</p>
              <p className="mt-0.5 text-[11px] text-t3">{selectedRow.unitNo} · {selectedRow.tenantName || "공실"}</p>
            </div>
            <table className="w-full text-[11px]">
              <thead className="bg-[#FBFCFD] text-t3">
                <tr className="h-8 border-b border-line2"><th className="px-4 text-left">부과월</th><th className="px-3 text-right">단가</th><th className="px-4 text-right">부과액</th></tr>
              </thead>
              <tbody>
                {(historyQuery.data ?? []).map((item) => (
                  <tr key={item.period} className="h-9 border-b border-line2 text-t2">
                    <td className="px-4">{item.period.slice(0, 7)}</td>
                    <td className="num px-3 text-right">{formatNumber(item.unitPrice)}</td>
                    <td className="num px-4 text-right font-semibold">{formatWon(item.charge)}</td>
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
