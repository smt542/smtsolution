"use client";
import React from "react";
import { DataTable, EmptyState, Spinner } from "@/components/common";
import type { Vendor } from "@/hooks/reactquery/vendors";
import type { VendorCategory } from "@/hooks/reactquery/vendorCategories";

interface Props {
  vendors: Vendor[];
  categories: VendorCategory[];
  isLoading: boolean;
  onRowClick: (vendor: Vendor) => void;
}

const COLUMNS = [
  { key: "category", label: "구분" },
  { key: "name", label: "업체명" },
  { key: "phone", label: "연락처" },
];

export function VendorList({ vendors, categories, isLoading, onRowClick }: Props) {
  const categoryMap = React.useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.label])),
    [categories],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (vendors.length === 0) {
    return <EmptyState message="등록된 업체가 없습니다" />;
  }

  // Build rows as Record<string, ReactNode> — no non-ReactNode values
  const rows = vendors.map((v) => ({
    category: v.categoryId != null ? (categoryMap[v.categoryId] ?? "-") : "-",
    name: v.name,
    phone: v.phone ?? "-",
  }));

  const handleRowClick = (row: Record<string, React.ReactNode>) => {
    // Identify the vendor by matching name (name is unique enough for UI lookup)
    const vendor = vendors.find((v) => v.name === row.name);
    if (vendor) onRowClick(vendor);
  };

  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      onRowClick={handleRowClick}
    />
  );
}
