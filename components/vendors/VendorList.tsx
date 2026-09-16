"use client";
import React from "react";
import { Spinner } from "@/components/common";
import type { Vendor } from "@/hooks/reactquery/vendors";
import type { VendorCategory } from "@/hooks/reactquery/vendorCategories";
import { vendorClasses } from "./vendorClasses";

interface Props {
  vendors: Vendor[];
  categories: VendorCategory[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onRowClick: (vendor: Vendor) => void;
}

export function VendorList({ vendors, categories, isLoading, isError, onRetry, onRowClick }: Props) {
  const categoryMap = React.useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.label])),
    [categories],
  );

  if (isLoading) {
    return (
      <div className={vendorClasses.tableWrap}>
        <div className={vendorClasses.loadingCell}>
          <Spinner label="협력업체 목록 불러오는 중" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={vendorClasses.tableWrap}>
        <div role="alert" className={vendorClasses.stateCell}>
          협력업체 목록을 불러오지 못했습니다.
          <button type="button" onClick={onRetry} className="ml-2 underline">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={vendorClasses.tableWrap}>
      <table className={vendorClasses.table}>
        <thead>
          <tr>
            <th>구분</th>
            <th>업체명</th>
            <th>연락처</th>
          </tr>
        </thead>
        <tbody>
          {vendors.length === 0 ? (
            <tr>
              <td colSpan={3} className={vendorClasses.stateCell}>
                등록된 업체가 없어요 · 업체 추가를 눌러 등록하세요
              </td>
            </tr>
          ) : vendors.map((vendor) => (
            <tr
              key={vendor.id}
              className={vendorClasses.vendorRow}
              onClick={() => onRowClick(vendor)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowClick(vendor);
                }
              }}
              tabIndex={0}
            >
              <td>{vendor.categoryId != null ? (categoryMap[vendor.categoryId] ?? "미분류") : "미분류"}</td>
              <td className={vendorClasses.vendorName}>{vendor.name}</td>
              <td className="num">{vendor.phone ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
