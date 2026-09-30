"use client";

import { useMemo, useState } from "react";
import { Badge, Button, EmptyState, Spinner } from "@/components/common";
import { useDebouncedValue, SEARCH_DEBOUNCE_MS } from "@/hooks/common";
import {
  usePlatformHqAccounts,
  type PlatformHqAccount,
  type PlatformHqAccountQuery,
} from "@/hooks/reactquery/platform";
import { formatDate, formatNumber } from "@/lib/format";
import { PlatformPagination, QueryError } from "../../../_components/PageElements";
import { PlatformPageContainer } from "../../../_components/PlatformPageContainer";
import { PlatformTopBarActions } from "../../../_components/PlatformShell";
import { HqAccountModal } from "./components/HqAccountModal";
import { HQ_ROLE_LABELS } from "./hqRoles";

const PAGE_SIZE = 10;

type ModalState =
  | { mode: "create"; account?: undefined }
  | { mode: "edit"; account: PlatformHqAccount };

function AccountStatus({ active }: { active: boolean }) {
  return (
    <Badge
      tone={active ? "green" : "gray"}
      className="inline-flex px-[9px] py-[3px] leading-[1.4]"
    >
      {active ? "활성" : "정지"}
    </Badge>
  );
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

export function AccountsWorkspace() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const query = useMemo<PlatformHqAccountQuery>(() => ({
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
  }), [debouncedSearch, page]);
  const { data, isPending, isError, isFetching, refetch } = usePlatformHqAccounts(query);
  const accounts = data?.rows ?? [];
  const total = data?.totalCount ?? 0;

  // 삭제로 마지막 쪽이 비면 첫 쪽으로 돌아간다(정본 drawAc: 쪽 수보다 크면 당긴다). 범위 밖 쪽은 행·전체 건수가 0으로 온다.
  if (page > 1 && data && !isFetching && accounts.length === 0) setPage(1);

  return (
    <PlatformPageContainer
      maxWidthClassName="max-w-none"
      paddingClassName="flex h-[calc(100dvh-62px)] flex-col gap-4 overflow-auto px-5 pb-[22px] pt-[22px] sm:px-6 sm:pb-[30px]"
    >
      <PlatformTopBarActions>
        <Button
          variant="primary"
          type="button"
          onClick={() => setModal({ mode: "create" })}
          className="shrink-0 cursor-pointer border border-transparent transition-colors"
        >
          ＋ 본사 계정 추가
        </Button>
      </PlatformTopBarActions>

      <section className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-2xl bg-surface shadow-card">
        <div className="flex flex-none items-center gap-2.5 border-b border-line2 px-[18px] py-[15px]">
          <h3 className="text-[15px] font-extrabold leading-[normal] text-t1">본사 계정</h3>
          <span className="text-xs font-semibold leading-[normal] text-t3">{formatNumber(total)}개</span>
          <div className="flex-1" />
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
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
                setPage(1);
              }}
              placeholder="이름 · 아이디 검색"
              className="w-[170px] bg-transparent text-[13px] font-semibold leading-[normal] text-t1 outline-none placeholder:font-medium placeholder:text-t4"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse leading-[normal]">
            <colgroup>
              <col className="w-[10.135%]" />
              <col className="w-[10.135%]" />
              <col className="w-[14.532%]" />
              <col className="w-[20.402%]" />
              <col className="w-[18.181%]" />
              <col className="w-[10.7%]" />
              <col className="w-[15.915%]" />
            </colgroup>
            <thead>
              <tr>
                {[
                  "이름",
                  "역할",
                  "아이디",
                  "전화번호",
                  "메모",
                  "상태",
                  "생성일",
                ].map((label) => (
                  <th key={label} className="whitespace-nowrap border-b border-line bg-[#FBFCFD] px-4 py-[11px] text-left text-xs font-bold text-t3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            {isPending ? (
              <tbody>
                <tr>
                  <td colSpan={7} className="border-b-0 p-0">
                    <div className="py-16">
                      <Spinner label="본사 계정 목록 불러오는 중" />
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : isError ? (
              <tbody>
                <tr>
                  <td colSpan={7} className="border-b-0 p-4">
                    <QueryError onRetry={() => void refetch()} />
                  </td>
                </tr>
              </tbody>
            ) : accounts.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={7} className="border-b-0 p-0">
                    <EmptyState message={search.trim() ? "검색 결과가 없습니다" : "등록된 본사 계정이 없습니다"} />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {accounts.map((account) => {
                  const name = account.fullName;
                  const role = account.hqRole ? HQ_ROLE_LABELS[account.hqRole] : "-";
                  const phone = account.phone || "-";
                  const memo = account.memo || "—";
                  const createdAt = formatDate(account.createdAt);
                  return (
                    <tr
                      key={account.userId}
                      tabIndex={0}
                      className="cursor-pointer hover:bg-row-hover"
                      onClick={() => setModal({ mode: "edit", account })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") setModal({ mode: "edit", account });
                      }}
                    >
                      <Cell value={name} className="text-[13.5px] font-bold" />
                      <Cell value={role} className="text-[13.5px] font-normal" />
                      <Cell value={account.username} className="text-[13.5px] font-normal" />
                      <Cell value={phone} className="num text-[13.5px] font-normal" />
                      <Cell value={memo} className="text-[12.5px] font-normal" />
                      <td title={account.isActive ? "활성" : "정지"} className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-line2 px-4 py-3 text-[13.5px] font-normal text-t1">
                        <AccountStatus active={account.isActive} />
                      </td>
                      <Cell value={createdAt} className="num text-[13.5px] font-normal" />
                    </tr>
                  );
                })}
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

      {modal ? (
        <HqAccountModal
          key={modal.mode === "edit" ? modal.account.userId : "create"}
          mode={modal.mode}
          account={modal.mode === "edit" ? modal.account : undefined}
          onClose={() => setModal(null)}
        />
      ) : null}
    </PlatformPageContainer>
  );
}
