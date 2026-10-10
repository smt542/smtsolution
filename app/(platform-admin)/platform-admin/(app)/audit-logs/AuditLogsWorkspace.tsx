"use client";

import { useMemo, useState } from "react";
import { Badge, CustomDropdown, EmptyState, Input, Spinner } from "@/components/common";
import { useDebouncedValue, SEARCH_DEBOUNCE_MS } from "@/hooks/common";
import { getKoreaToday } from "@/hooks/reactquery/dashboard";
import {
  AUDIT_LOG_CATEGORY_LABELS,
  auditLogActionLabel,
  usePlatformAuditLogs,
  type AuditLogCategory,
  type PlatformAuditLog,
  type PlatformAuditLogQuery,
} from "@/hooks/reactquery/platform";
import { formatDateTime, formatNumber } from "@/lib/format";
import {
  ADMIN_DROPDOWN_MENU_CLASS,
  ADMIN_TOOLBAR_DROPDOWN_CLASS,
} from "../../../_components/adminDropdownClasses";
import { PlatformPagination, QueryError } from "../../../_components/PageElements";
import { PlatformPageContainer } from "../../../_components/PlatformPageContainer";
import { AuditLogDetailModal } from "./components/AuditLogDetailModal";

const PAGE_SIZE = 20;
const COLUMN_COUNT = 7;

const CATEGORY_TONE: Record<AuditLogCategory, "blue" | "green" | "red" | "amber" | "gray"> = {
  login: "gray",
  payment: "green",
  account: "blue",
  data: "amber",
  resident: "green",
  platform: "blue",
  other: "gray",
};

const CATEGORY_OPTIONS = [
  { value: "all", label: "전체 분류" },
  ...(Object.keys(AUDIT_LOG_CATEGORY_LABELS) as AuditLogCategory[]).map((value) => ({
    value,
    label: AUDIT_LOG_CATEGORY_LABELS[value],
  })),
];

const PERIOD_OPTIONS = [
  { value: "7", label: "최근 7일" },
  { value: "30", label: "최근 30일" },
  { value: "90", label: "최근 90일" },
  { value: "all", label: "전체 기간" },
];

/** "YYYY-MM-DD" − days (UTC 고정 계산) */
function minusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function Cell({ value, className = "" }: { value: string; className?: string }) {
  return (
    <td
      title={value}
      className={`overflow-hidden text-ellipsis whitespace-nowrap border-b border-line2 px-4 py-3 text-t1 ${className}`}
    >
      {value}
    </td>
  );
}

function actorText(log: PlatformAuditLog): string {
  if (log.actorName) return log.actorUsername ? `${log.actorName} (${log.actorUsername})` : log.actorName;
  return log.actorUsername ?? "시스템";
}

function targetText(log: PlatformAuditLog): string {
  if (!log.tableName) return "-";
  return log.rowPk ? `${log.tableName} #${log.rowPk}` : log.tableName;
}

export function AuditLogsWorkspace() {
  const [today] = useState(getKoreaToday);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<AuditLogCategory | "all">("all");
  const [periodDays, setPeriodDays] = useState("30");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PlatformAuditLog | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const query = useMemo<PlatformAuditLogQuery>(() => ({
    search: debouncedSearch,
    category: category === "all" ? null : category,
    from: periodDays === "all" ? null : minusDays(today, Number(periodDays) - 1),
    to: periodDays === "all" ? null : today,
    page,
    pageSize: PAGE_SIZE,
  }), [debouncedSearch, category, periodDays, today, page]);
  const { data, isPending, isError, refetch } = usePlatformAuditLogs(query);
  const logs = data?.rows ?? [];
  const total = data?.totalCount ?? 0;

  return (
    <PlatformPageContainer
      maxWidthClassName="max-w-none"
      paddingClassName="flex h-[calc(100dvh-62px)] flex-col gap-4 overflow-auto px-5 pb-[22px] pt-[22px] sm:px-6 sm:pb-[30px]"
    >
      <section className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-2xl bg-surface shadow-card">
        <div className="flex flex-none flex-wrap items-center gap-2.5 border-b border-line2 px-[18px] py-[15px]">
          <h3 className="text-[15px] font-extrabold leading-[normal] text-t1">감사 로그</h3>
          <span className="text-xs font-semibold leading-[normal] text-t3">{formatNumber(total)}건</span>
          <div className="flex-1" />
          <label className={`relative ${ADMIN_TOOLBAR_DROPDOWN_CLASS}`}>
            <span className="sr-only">조회 기간</span>
            <CustomDropdown
              chevron="rotate"
              chevronMs={180}
              ariaLabel="조회 기간"
              value={periodDays}
              options={PERIOD_OPTIONS}
              position="fixed"
              menuAlign="end"
              menuMinWidth={140}
              menuClassName={ADMIN_DROPDOWN_MENU_CLASS}
              onChange={(value) => {
                setPeriodDays(value);
                setPage(1);
              }}
            />
          </label>
          <label className={`relative ${ADMIN_TOOLBAR_DROPDOWN_CLASS}`}>
            <span className="sr-only">분류</span>
            <CustomDropdown
              chevron="rotate"
              chevronMs={180}
              ariaLabel="분류"
              value={category}
              options={CATEGORY_OPTIONS}
              position="fixed"
              menuAlign="end"
              menuMinWidth={140}
              menuClassName={ADMIN_DROPDOWN_MENU_CLASS}
              onChange={(value) => {
                setCategory(value as AuditLogCategory | "all");
                setPage(1);
              }}
            />
          </label>
          <label className="flex h-8 items-center gap-[7px] rounded-[10px] border border-transparent bg-bg px-[11px] transition-[background,border,box-shadow] duration-[120ms] focus-within:border-blue focus-within:bg-surface focus-within:ring-[3px] focus-within:ring-[rgba(20,164,151,0.13)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 shrink-0 text-t4"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <Input
              unstyled
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
                setPage(1);
              }}
              placeholder="테넌트 · 작업자 · 작업 코드 검색"
              className="w-[210px] bg-transparent px-[2px] py-px text-[13px] font-semibold leading-[normal] text-t1 outline-none placeholder:font-medium placeholder:text-t4"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse leading-[normal]">
            <colgroup>
              <col className="w-[15%]" />
              <col className="w-[14%]" />
              <col className="w-[17%]" />
              <col className="w-[10%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr>
                {["일시", "테넌트", "작업자", "분류", "작업", "대상", "IP"].map((label) => (
                  <th
                    key={label}
                    className="sticky top-0 z-[1] whitespace-nowrap border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-left text-[12px] font-bold text-t3"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            {isPending ? (
              <tbody>
                <tr>
                  <td colSpan={COLUMN_COUNT} className="border-b-0 p-0">
                    <div className="py-16">
                      <Spinner label="감사 로그 불러오는 중" />
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : isError ? (
              <tbody>
                <tr>
                  <td colSpan={COLUMN_COUNT} className="border-b-0 p-4">
                    <QueryError onRetry={() => void refetch()} />
                  </td>
                </tr>
              </tbody>
            ) : logs.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={COLUMN_COUNT} className="border-b-0 p-0">
                    <EmptyState message={search.trim() ? "검색 결과가 없습니다" : "기록된 감사 로그가 없습니다"} />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-row-hover"
                    onClick={() => setSelected(log)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") setSelected(log);
                    }}
                  >
                    <Cell value={formatDateTime(log.createdAt)} className="num text-[13.5px] font-normal" />
                    <Cell value={log.orgName ?? "-"} className="text-[13.5px] font-bold" />
                    <Cell value={actorText(log)} className="text-[13.5px] font-normal" />
                    <td className="overflow-hidden whitespace-nowrap border-b border-line2 px-4 py-3 text-[13.5px] font-normal text-t1">
                      <Badge
                        tone={CATEGORY_TONE[log.category] ?? "gray"}
                        className="inline-flex px-[9px] py-[3px] leading-[1.4]"
                      >
                        {AUDIT_LOG_CATEGORY_LABELS[log.category] ?? log.category}
                      </Badge>
                    </td>
                    <Cell value={auditLogActionLabel(log.action)} className="text-[13.5px] font-semibold" />
                    <Cell value={targetText(log)} className="text-[12.5px] font-normal text-t2" />
                    <Cell value={log.ip ?? "-"} className="num text-[12.5px] font-normal text-t2" />
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        <div className="flex-none">
          <PlatformPagination
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={total}
            onPageChange={setPage}
            numeric
            compact
            alwaysShow
          />
        </div>
      </section>

      {selected ? (
        <AuditLogDetailModal log={selected} onClose={() => setSelected(null)} />
      ) : null}
    </PlatformPageContainer>
  );
}
