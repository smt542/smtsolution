"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Badge, Button, EmptyState, Modal, Spinner } from "@/components/common";
import { appToast as toast } from "@/hooks/common/useAppToast";
import {
  listPlatformOrganizations,
  platformKeys,
  usePlatformOrganizationContractKpis,
  useUpdateOrganizationStatus,
  useCreatePlatformOrganization,
  useUpdatePlatformOrganization,
  useSetOrgDeleted,
  uploadOrganizationContractFile,
  removeOrganizationContractFile,
  type OrganizationStatus,
  type PlatformOrganization,
  type PlatformOrganizationQuery,
  type PlatformOrganizationStatusFilter,
} from "@/hooks/reactquery/platform";
import { formatNumber } from "@/lib/format";
import { SEARCH_DEBOUNCE_MS, useAsyncAction, useDebouncedValue } from "@/hooks/common";
import {
  PlatformPagination,
  QueryError,
  StatusBadge,
} from "../../../_components/PageElements";
import { PlatformPageContainer } from "../../../_components/PlatformPageContainer";
import { PlatformTopBarActions } from "../../../_components/PlatformShell";
import { TableFrame } from "../../../_components/TableFrame";
import { OrgStatusControl } from "./components/OrgStatusControl";
import type { OrgCreateSubmitValues, OrgEditSubmitValues } from "./components/OrgFormModal";
import { OrgRowActions } from "./components/OrgRowActions";

const OrgFormModal = dynamic(() =>
  import("./components/OrgFormModal").then((module) => module.OrgFormModal),
);

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const PAGE_SIZE = 25;
const STATUS_FILTERS: Array<{
  id: "all" | PlatformOrganizationStatusFilter;
  label: string;
}> = [
  { id: "all", label: "전체" },
  { id: "operating", label: "운영" },
  { id: "suspended", label: "정지" },
  { id: "terminated", label: "해지" },
];

export default function OrganizationsWorkspace() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PlatformOrganizationStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PlatformOrganization | null>(null);
  const [pwNotice, setPwNotice] = useState<{ username: string; tempPassword: string } | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const query = useMemo<PlatformOrganizationQuery>(() => ({
    includeDeleted: true,
    status: statusFilter === "all" ? undefined : statusFilter,
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
  }), [debouncedSearch, page, statusFilter]);
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: platformKeys.organizations(query),
    queryFn: () => listPlatformOrganizations(query),
    placeholderData: keepPreviousData,
  });
  const organizations = data?.rows ?? [];
  const contractKpis = usePlatformOrganizationContractKpis();
  const updateStatus = useUpdateOrganizationStatus();
  const createOrg = useCreatePlatformOrganization();
  const updateOrg = useUpdatePlatformOrganization();
  const setDeleted = useSetOrgDeleted();
  const createContractFileAction = useAsyncAction();
  const updateContractFileAction = useAsyncAction();
  const isCreatingOrganization = createOrg.isPending || createContractFileAction.isPending;
  const isUpdatingOrganization = updateOrg.isPending || updateContractFileAction.isPending;
  const isOrganizationListRefreshing = isFetching && !isPending;

  const handleStatus = async (id: number, next: OrganizationStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status: next });
      toast.success("조직 상태를 변경했습니다.");
    } catch (e) {
      toast.error(e, "상태 변경에 실패했습니다.");
    }
  };

  const handleCreate = async (v: OrgCreateSubmitValues) => {
    let uploadedPath: string | null = null;
    try {
      if (v.contractFile) {
        uploadedPath = await createContractFileAction.run(() =>
          uploadOrganizationContractFile(v.contractFile as File),
        );
      }
      const result = await createOrg.mutateAsync({
        name: v.name,
        slug: v.slug,
        phone: v.phone,
        contractStartDate: v.contractStartDate,
        contractEndDate: v.contractEndDate,
        representativeName: v.representativeName,
        businessRegistrationNumber: v.businessRegistrationNumber,
        fax: v.fax,
        email: v.email,
        address: v.address,
        region: v.region,
        operatingHours: v.operatingHours || null,
        contractFilePath: uploadedPath,
        owner: {
          username: v.ownerUsername,
          fullName: v.ownerFullName,
          phone: v.ownerPhone || null,
        },
      });
      setPwNotice(result.owner);
      toast.success("관리회사를 입점했습니다.");
    } catch (e) {
      if (uploadedPath) {
        await removeOrganizationContractFile(uploadedPath).catch(() => undefined);
      }
      toast.error(e, "입점에 실패했습니다.");
      throw e;
    }
  };

  const handleEdit = async (v: OrgEditSubmitValues) => {
    if (!editTarget) return;
    let uploadedPath: string | null = null;
    const previousPath = editTarget.contractFilePath;
    try {
      if (v.contractFile) {
        uploadedPath = await updateContractFileAction.run(() =>
          uploadOrganizationContractFile(v.contractFile as File, editTarget.id),
        );
      }
      const contractFilePath = uploadedPath
        ?? (v.removeContractFile ? null : previousPath);
      await updateOrg.mutateAsync({
        id: editTarget.id,
        input: {
          name: v.name,
          slug: v.slug,
          phone: v.phone,
          contractStartDate: v.contractStartDate,
          contractEndDate: v.contractEndDate,
          representativeName: v.representativeName,
          businessRegistrationNumber: v.businessRegistrationNumber,
          fax: v.fax,
          email: v.email,
          address: v.address,
          region: v.region,
          operatingHours: v.operatingHours || null,
          contractFilePath,
        },
      });
      if (previousPath && previousPath !== contractFilePath) {
        await removeOrganizationContractFile(previousPath).catch(() => {
          toast.warning("이전 계약서 파일 정리가 필요합니다.");
        });
      }
      toast.success("조직 계약 정보를 수정했습니다.");
    } catch (e) {
      if (uploadedPath) {
        await removeOrganizationContractFile(uploadedPath).catch(() => undefined);
      }
      toast.error(e, "수정에 실패했습니다.");
      throw e;
    }
  };

  const handleToggleDeleted = async (id: number, deleted: boolean) => {
    try {
      await setDeleted.mutateAsync({ id, deleted });
      toast.success(deleted ? "조직을 해지했습니다." : "조직을 복구했습니다.");
    } catch (e) {
      toast.error(e, "처리에 실패했습니다.");
    }
  };

  return (
    <PlatformPageContainer
      maxWidthClassName="max-w-none"
      paddingClassName="px-5 py-[22px] sm:px-6 sm:pb-[30px]"
    >
      <PlatformTopBarActions>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[11px] border border-transparent bg-blue px-[15px] text-[13.5px] font-bold text-white shadow-hf-btn transition-colors hover:bg-blue-d"
        >
          + 관리회사 입점
        </button>
      </PlatformTopBarActions>

      <section className="grid gap-[13px] sm:grid-cols-2 xl:grid-cols-4" aria-label="계약 현황">
        {[
          {
            label: "운영 중",
            value: contractKpis.data?.operatingCount,
            detail: `전체 ${formatNumber(contractKpis.data?.operatingCount ?? 0)}곳`,
          },
          {
            label: "90일 내 만료",
            value: contractKpis.data?.expiringWithin90DaysCount,
            detail: "연장 확인 필요",
          },
          {
            label: "정지",
            value: contractKpis.data?.suspendedCount,
            detail: "계약 확인 필요",
          },
          {
            label: "해지",
            value: contractKpis.data?.terminatedLast12MonthsCount,
            detail: "최근 12개월",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-[15px] bg-surface px-[18px] py-[17px] shadow-card">
            <div className="text-[12.5px] font-bold text-t3">{kpi.label}</div>
            <div className="mt-[9px] text-[26px] font-extrabold tracking-[-0.03em] text-t1 num">
              {contractKpis.isPending ? "-" : formatNumber(kpi.value ?? 0)}
              <span className="ml-[3px] text-sm font-bold tracking-normal text-t3">곳</span>
            </div>
            <div
              className={`mt-[7px] text-xs font-bold num ${
                kpi.label === "정지" ? "text-red" : "text-t3"
              }`}
            >
              {kpi.detail}
            </div>
          </div>
        ))}
      </section>

      <div className="mt-4 flex flex-col flex-wrap gap-2.5 sm:flex-row sm:items-center">
        <div
          className="inline-flex w-fit flex-wrap items-center gap-0.5 rounded-[11px] bg-[#EDF0F3] p-1"
          aria-label="조직 상태 필터"
        >
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={statusFilter === filter.id}
              onClick={() => {
                setStatusFilter(filter.id);
                setPage(1);
              }}
              className={`cursor-pointer rounded-lg px-[15px] py-[7px] text-sm font-bold transition-colors ${
                statusFilter === filter.id
                  ? "bg-surface text-t1 shadow-[0_2px_6px_rgba(23,31,40,0.1)]"
                  : "text-t3 hover:text-t1"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <label className="flex h-10 min-w-60 items-center gap-2 rounded-[11px] border border-line bg-surface px-[13px] focus-within:border-blue focus-within:ring-[3px] focus-within:ring-blue-t">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 shrink-0 text-t3"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="업체명 · 지역 검색"
            className="w-full bg-transparent text-[13.5px] font-semibold text-t1 outline-none placeholder:font-medium placeholder:text-t4"
          />
        </label>
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl bg-surface shadow-card">
        <div className="flex items-center gap-2.5 border-b border-line2 px-[18px] py-[15px]">
          <h3 className="text-[15px] font-extrabold text-t1">조직 목록</h3>
          <span className="text-xs font-semibold text-t3">
            {formatNumber(data?.totalCount ?? 0)}곳
          </span>
          {isOrganizationListRefreshing ? (
            <Spinner label="조직 목록 갱신 중" size="small" showLabel className="px-2 py-1" />
          ) : null}
        </div>

        {isPending ? (
          <div className="py-16">
            <Spinner label="조직 목록 불러오는 중" />
          </div>
        ) : isError ? (
          <div className="p-4">
            <QueryError onRetry={() => void refetch()} />
          </div>
        ) : organizations.length === 0 ? (
          <EmptyState
            message={
              search || statusFilter !== "all"
                ? "해당 조건의 조직이 없습니다"
                : "조회 가능한 조직이 없습니다"
            }
          />
        ) : (
          <TableFrame minWidthClassName="min-w-[1480px]">
            <thead>
              <tr className="border-b border-line bg-[#FBFCFD] text-left text-xs font-bold text-t3">
                <th className="w-[24%] whitespace-nowrap px-4 py-[11px]">조직</th>
                <th className="whitespace-nowrap px-4 py-[11px] text-right">건물</th>
                <th className="whitespace-nowrap px-4 py-[11px] text-right">세대</th>
                <th className="whitespace-nowrap px-4 py-[11px] text-right">직원</th>
                <th className="whitespace-nowrap px-4 py-[11px] text-right">세입자</th>
                <th className="whitespace-nowrap px-4 py-[11px]">상태</th>
                <th className="whitespace-nowrap px-4 py-[11px]">계약 시작</th>
                <th className="whitespace-nowrap px-4 py-[11px]">계약 만료</th>
                <th className="whitespace-nowrap px-4 py-[11px] text-right">계정</th>
                <th className="whitespace-nowrap px-4 py-[11px] text-right">포인트 잔액</th>
                <th className="whitespace-nowrap px-4 py-[11px]">등록일</th>
                <th className="whitespace-nowrap px-4 py-[11px] text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((organization) => (
                <tr
                  key={organization.id}
                  className="cursor-pointer border-b border-line2 text-[13.5px] text-t1 last:border-0 hover:bg-[#FBFCFD]"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/platform-admin/organizations/${organization.id}`}
                      className="text-sm font-extrabold tracking-[-0.01em] text-t1 hover:text-blue"
                    >
                      {organization.name}
                    </Link>
                    <div className="mt-[3px] text-xs font-semibold text-t3">
                      {organization.region ?? "지역 미설정"}
                      <span className="mx-1 text-t4">·</span>
                      {organization.slug ?? "회사코드 미설정"}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-t1 num">
                    {formatNumber(organization.buildingCount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-t1 num">
                    {formatNumber(organization.unitCount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-t1 num">
                    {formatNumber(organization.employeeCount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-t1 num">
                    {formatNumber(organization.tenantCount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {organization.deletedAt ? (
                      <Badge tone="gray" className="inline-flex px-[9px] py-[3px] leading-[1.4]">
                        해지됨
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <StatusBadge status={organization.status} />
                        <OrgStatusControl
                          status={organization.status}
                          isPending={updateStatus.isPending}
                          onChange={(next) => handleStatus(organization.id, next)}
                        />
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-t3 num">
                    {organization.contractStartDate ?? "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-t3 num">
                    {organization.contractEndDate ?? "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-t1 num">
                    {formatNumber(organization.accountCount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold text-t1 num">
                    {formatNumber(organization.pointBalance)} P
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-t3 num">
                    {dateFormatter.format(new Date(organization.createdAt))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex justify-end">
                      <OrgRowActions
                        org={organization}
                        onEdit={() => setEditTarget(organization)}
                        onToggleDeleted={(deleted) => handleToggleDeleted(organization.id, deleted)}
                        disabled={setDeleted.isPending}
                        isPending={setDeleted.isPending && setDeleted.variables?.id === organization.id}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableFrame>
        )}
        <PlatformPagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={data?.totalCount ?? 0}
          onPageChange={setPage}
          numeric
          compact
          totalLabel={`전체 ${formatNumber(data?.totalCount ?? 0)}곳 · ${formatNumber(page)}/${formatNumber(Math.max(1, Math.ceil((data?.totalCount ?? 0) / PAGE_SIZE)))}`}
        />
      </section>

      {createOpen && (
        <OrgFormModal
          mode="create"
          open
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
          isPending={isCreatingOrganization}
        />
      )}

      {editTarget && (
        <OrgFormModal
          mode="edit"
          open
          onClose={() => setEditTarget(null)}
          defaultValues={{
            name: editTarget.name,
            slug: editTarget.slug ?? "",
            phone: editTarget.phone ?? "",
            contractStartDate: editTarget.contractStartDate ?? "",
            contractEndDate: editTarget.contractEndDate ?? "",
            representativeName: editTarget.representativeName ?? "",
            businessRegistrationNumber: editTarget.businessRegistrationNumber ?? "",
            fax: editTarget.fax ?? "",
            email: editTarget.email ?? "",
            address: editTarget.address ?? "",
            region: editTarget.region ?? "",
            operatingHours: editTarget.operatingHours ?? "",
          }}
          defaultContractFilePath={editTarget.contractFilePath}
          onSubmit={handleEdit}
          isPending={isUpdatingOrganization}
        />
      )}

      {pwNotice && (
        <Modal open onClose={() => setPwNotice(null)} title="관리자 임시 비밀번호">
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-t2">
              아래 계정 정보를 관리자에게 <b>안전하게 전달</b>하세요. 이 창을 닫으면 다시 볼 수 없습니다.
            </p>
            <div className="rounded-xl border border-line bg-bg/50 p-3 font-mono">
              <div>
                아이디: <b>{pwNotice.username}</b>
              </div>
              <div>
                임시 비밀번호: <b>{pwNotice.tempPassword}</b>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="primary"
                className="h-10 cursor-pointer whitespace-nowrap rounded-[11px] px-[15px] text-[13.5px]"
                onClick={() => {
                  void navigator.clipboard?.writeText(
                    `아이디: ${pwNotice.username} / 임시비밀번호: ${pwNotice.tempPassword}`,
                  );
                  toast.success("복사했습니다.");
                }}
              >
                복사
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PlatformPageContainer>
  );
}
