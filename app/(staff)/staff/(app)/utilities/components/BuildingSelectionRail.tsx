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

function signedNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";
  if (value > 0) return `+${formatNumber(value)}`;
  return formatNumber(value);
}

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
    <aside className={`flex min-h-0 w-full shrink-0 flex-col gap-4 transition-opacity min-[1101px]:w-[322px] ${disabled ? "pointer-events-none opacity-45" : ""}`}>
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
      <section className="flex h-[433px] min-h-[190px] flex-none flex-col overflow-hidden rounded-[16px] bg-white shadow-card">
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
              <tr className="h-[36.5px]">
                <th className="h-[36.5px] w-[70px] border-b border-line2 px-[11px] py-0 text-left leading-[15px]">코드</th>
                <th className="h-[36.5px] w-[118px] border-b border-line2 px-[11px] py-0 text-left leading-[15px]">건물명</th>
                <th className="h-[36.5px] border-b border-line2 px-[11px] py-0 text-left leading-[15px]">주소</th>
                <th className="h-[36.5px] w-[52px] border-b border-line2 px-[11px] py-0 text-right leading-[15px]">수도</th>
              </tr>
            </thead>
            <tbody>
              {filteredBuildings.map((building) => {
                const selected = building.id === buildingId;
                return (
                  <tr
                    key={building.id}
                    onClick={() => onBuildingChange(building.id)}
                    className={`h-[41px] cursor-pointer transition-colors ${
                      selected ? "bg-blue-t text-t1" : "text-t1 hover:bg-row-hover"
                    }`}
                  >
                    <td className="h-[41px] truncate border-b border-line2 px-[11px] py-[12px] font-medium leading-[16px]">{building.code || "-"}</td>
                    <td className="h-[41px] truncate border-b border-line2 px-[11px] py-[12px] font-bold leading-[16px]">{building.name}</td>
                    <td className="h-[41px] truncate border-b border-line2 px-[11px] py-[12px] font-medium leading-[16px]">{building.address || "-"}</td>
                    <td className="num h-[41px] border-b border-line2 px-[11px] py-[12px] text-right font-bold leading-[16px]">{customerNumberCounts[building.id] ?? 0}</td>
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

      <section className="flex min-h-[250px] flex-1 basis-[52%] flex-col overflow-hidden rounded-[16px] bg-white shadow-card min-[1101px]:max-h-[354px]">
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
          <div className="min-h-0 flex-1 overflow-hidden">
            <table className="w-[529.515px] table-fixed border-collapse text-[14px]">
              <thead className="bg-[#FBFCFD] text-[14px] font-bold text-t3">
                <tr className="h-[34.5px] border-b border-line2">
                  <th className="w-[90.859px] px-4 py-[8.25px] text-left">일시</th>
                  <th className="w-[80.406px] px-4 py-[8.25px] text-center">고지금액</th>
                  <th className="w-[56.203px] px-4 py-[8.25px] text-center">증감</th>
                  <th className="w-[80.734px] px-4 py-[8.25px] text-center">부과액</th>
                  <th className="w-[95.734px] px-4 py-[8.25px] text-center">부과액 증감</th>
                  <th className="w-[62.766px] px-4 py-[8.25px] text-center">단가</th>
                  <th className="w-[62.813px] px-4 py-[8.25px] text-center">증감</th>
                </tr>
              </thead>
              <tbody>
                {(historyQuery.data ?? []).map((item, index, history) => {
                  const previous = history[index + 1];
                  const chargeDelta = item.charge !== null && previous?.charge !== null && previous
                    ? item.charge - previous.charge
                    : null;
                  const unitPriceDelta = item.unitPrice !== null && previous?.unitPrice !== null && previous
                    ? item.unitPrice - previous.unitPrice
                    : null;

                  return (
                    <tr key={item.period} className="h-[35px] border-b border-line2 font-semibold text-t1 hover:bg-row-hover">
                      <td className="w-[90.859px] px-4 py-[9px] whitespace-nowrap">{item.period.slice(0, 7)}</td>
                      <td className="num w-[80.406px] px-4 py-[9px] text-right text-t3">-</td>
                      <td className="num w-[56.203px] px-4 py-[9px] text-right text-t3">-</td>
                      <td className="num w-[80.734px] px-4 py-[9px] text-right">{formatNumber(item.charge)}</td>
                      <td className="num w-[95.734px] px-4 py-[9px] text-right">{signedNumber(chargeDelta)}</td>
                      <td className="num w-[62.766px] px-4 py-[9px] text-right">{formatNumber(item.unitPrice)}</td>
                      <td className="num w-[62.813px] px-4 py-[9px] text-right">{signedNumber(unitPriceDelta)}</td>
                    </tr>
                  );
                })}
                {(historyQuery.data ?? []).length === 0 && (
                  <tr><td colSpan={7} className="h-28 text-center text-t3">최근 이력이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </aside>
  );
}
