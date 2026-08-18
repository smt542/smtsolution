"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, EmptyState, Modal, SearchBar, Spinner } from "@/components/common";
import { toast } from "sonner";
import {
  usePlatformOrganizations,
  useUpdateOrganizationStatus,
  useCreatePlatformOrganization,
  useUpdatePlatformOrganization,
  useSetOrgDeleted,
  type OrganizationStatus,
  type PlatformOrganization,
} from "@/hooks/reactquery/platform";
import type {
  OrgCreateFormValues,
  OrgEditFormValues,
} from "@/components/forms/schema/platformOrganization";
import {
  DataScopeNotice,
  PageHeader,
  QueryError,
  StatusBadge,
} from "../../_components/PageElements";
import { OrgStatusControl } from "./components/OrgStatusControl";
import { OrgFormModal } from "./components/OrgFormModal";
import { OrgRowActions } from "./components/OrgRowActions";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export default function PlatformOrganizationsPage() {
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PlatformOrganization | null>(null);
  const [pwNotice, setPwNotice] = useState<{ username: string; tempPassword: string } | null>(null);

  const { data: organizations = [], isPending, isError, refetch } = usePlatformOrganizations();
  const updateStatus = useUpdateOrganizationStatus();
  const createOrg = useCreatePlatformOrganization();
  const updateOrg = useUpdatePlatformOrganization();
  const setDeleted = useSetOrgDeleted();

  const handleStatus = async (id: number, next: OrganizationStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status: next });
      toast.success("조직 상태를 변경했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "상태 변경에 실패했습니다.");
    }
  };

  const handleCreate = async (v: OrgCreateFormValues) => {
    try {
      const result = await createOrg.mutateAsync({
        name: v.name,
        slug: v.slug,
        phone: v.phone || null,
        owner: {
          username: v.ownerUsername,
          fullName: v.ownerFullName,
          phone: v.ownerPhone || null,
        },
      });
      setCreateOpen(false);
      setPwNotice(result.owner);
      toast.success("관리회사를 입점했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "입점에 실패했습니다.");
    }
  };

  const handleEdit = async (v: OrgEditFormValues) => {
    if (!editTarget) return;
    try {
      await updateOrg.mutateAsync({
        id: editTarget.id,
        input: { name: v.name, slug: v.slug, phone: v.phone || null },
      });
      setEditTarget(null);
      toast.success("조직 정보를 수정했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "수정에 실패했습니다.");
    }
  };

  const handleToggleDeleted = async (id: number, deleted: boolean) => {
    try {
      await setDeleted.mutateAsync({ id, deleted });
      toast.success(deleted ? "조직을 해지했습니다." : "조직을 복구했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리에 실패했습니다.");
    }
  };

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("ko-KR");
    return organizations.filter((organization) => {
      if (!showDeleted && organization.deletedAt) return false;
      if (!keyword) return true;
      return `${organization.name} ${organization.slug ?? ""}`
        .toLocaleLowerCase("ko-KR")
        .includes(keyword);
    });
  }, [organizations, search, showDeleted]);

  const visibleCount = useMemo(
    () => organizations.filter((o) => showDeleted || !o.deletedAt).length,
    [organizations, showDeleted],
  );

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="ORGANIZATIONS"
        title="조직 관리"
        description="입점 조직의 기본 정보와 운영 규모를 조회하고, 입점·수정·해지를 관리합니다."
      />

      <div className="mt-5">
        <DataScopeNotice />
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-t1">조직 목록</h3>
            <p className="mt-1 text-xs text-t3">총 {visibleCount.toLocaleString("ko-KR")}개</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-t3">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              해지 포함
            </label>
            <div className="w-full sm:w-64">
              <SearchBar value={search} onChange={setSearch} placeholder="조직명·회사코드 검색" />
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-xl bg-blue px-4 py-2.5 text-sm font-bold text-white hover:bg-blue/90"
            >
              + 관리회사 입점
            </button>
          </div>
        </div>

        {isPending ? (
          <div className="py-16">
            <Spinner />
          </div>
        ) : isError ? (
          <div className="p-4">
            <QueryError onRetry={() => void refetch()} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState message={search ? "검색 결과가 없습니다" : "조회 가능한 조직이 없습니다"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/70 text-left text-xs font-bold text-t3">
                  <th className="px-5 py-3">조직</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3 text-right">건물</th>
                  <th className="px-4 py-3 text-right">계정</th>
                  <th className="px-4 py-3 text-right">포인트 잔액</th>
                  <th className="px-5 py-3">등록일</th>
                  <th className="px-5 py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((organization) => (
                  <tr
                    key={organization.id}
                    className={`border-b border-line last:border-0 hover:bg-bg/50 ${
                      organization.deletedAt ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/platform-admin/organizations/${organization.id}`}
                        className="font-bold text-t1 hover:text-blue hover:underline"
                      >
                        {organization.name}
                      </Link>
                      <div className="mt-1 text-xs text-t3">
                        {organization.slug ?? "회사코드 미설정"}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {organization.deletedAt ? (
                        <span className="inline-flex rounded-full bg-bg px-2.5 py-1 text-xs font-bold text-t3">
                          해지됨
                        </span>
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
                    <td className="px-4 py-4 text-right font-bold text-t1 num">
                      {organization.buildingCount.toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-t1 num">
                      {organization.accountCount.toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-4 text-right font-extrabold text-t1 num">
                      {organization.pointBalance.toLocaleString("ko-KR")} P
                    </td>
                    <td className="px-5 py-4 text-t2 num">
                      {dateFormatter.format(new Date(organization.createdAt))}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        <OrgRowActions
                          org={organization}
                          onEdit={() => setEditTarget(organization)}
                          onToggleDeleted={(deleted) => handleToggleDeleted(organization.id, deleted)}
                          isPending={setDeleted.isPending}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <OrgFormModal
        mode="create"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        isPending={createOrg.isPending}
      />

      {editTarget && (
        <OrgFormModal
          mode="edit"
          open
          onClose={() => setEditTarget(null)}
          defaultValues={{
            name: editTarget.name,
            slug: editTarget.slug ?? "",
            phone: editTarget.phone ?? "",
          }}
          onSubmit={handleEdit}
          isPending={updateOrg.isPending}
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
    </div>
  );
}
