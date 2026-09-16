"use client";

import React, { useMemo, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import {
  Button,
  EmptyState,
  Modal,
  SearchBar,
  Select,
  Spinner,
} from "@/components/common";
import {
  useApproveResidentClaim,
  useRejectResidentClaim,
  useResidentClaims,
  type ResidentClaim,
} from "@/hooks/reactquery/residentClaims";
import {
  useOrgOccupancyLookup,
  type OrgOccupancyOption,
} from "./useOrgOccupancyLookup";

type LinkState = "on" | "off" | "fail";
type LinkFilter = "all" | LinkState;

const STATUS_FILTERS: { value: LinkFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "on", label: "연결됨" },
  { value: "off", label: "미연결" },
  { value: "fail", label: "매핑실패" },
];

const COLUMNS = [
  "건물명",
  "호실",
  "입주자명",
  "연락처",
  "카카오 ID",
  "카카오 이름",
  "연결 상태",
  "연결일",
];

const STATUS_LABELS: Record<LinkState, string> = {
  on: "연결됨",
  off: "미연결",
  fail: "매핑실패",
};

function linkState(claim: ResidentClaim): LinkState {
  if (claim.status === "linked") return "on";
  if (claim.status === "pending") return "fail";
  return "off";
}

function formatDate(value: string | null): string {
  return value ? value.slice(0, 10).replaceAll("-", ".") : "-";
}

function claimDate(claim: ResidentClaim): string {
  if (claim.status === "linked") return formatDate(claim.resolvedAt);
  if (claim.status === "pending") return formatDate(claim.createdAt);
  return "-";
}

function claimUnit(claim: ResidentClaim): string {
  return claim.unitNo ?? claim.claimedUnitText ?? "-";
}

function claimName(claim: ResidentClaim): string {
  return claim.occupancyTenantName ?? claim.claimedName ?? claim.kakaoName ?? "-";
}

function claimPhone(claim: ResidentClaim): string {
  return claim.occupancyPhone ?? claim.claimedPhone ?? claim.residentPhone ?? "-";
}

function StatusBadge({ state }: { state: LinkState }) {
  const color = {
    on: "bg-green-t text-green",
    off: "bg-bg text-t3",
    fail: "bg-red-t text-danger",
  }[state];

  return (
    <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${color}`}>
      {STATUS_LABELS[state]}
    </span>
  );
}

function OccupancyButton({
  option,
  selected,
  linkedName,
  onSelect,
}: {
  option: OrgOccupancyOption;
  selected: boolean;
  linkedName?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 border-b border-line2 px-4 py-3 text-left last:border-0 hover:bg-bg ${
        selected ? "bg-brand-tint ring-1 ring-inset ring-brand" : "bg-surface"
      }`}
    >
      <b className="text-sm text-t1">{option.buildingName} {option.unitNo}호</b>
      <span className="text-xs font-semibold text-t3">{option.tenantName ?? "-"}</span>
      <i className="ml-auto text-xs font-semibold not-italic text-t3">
        {linkedName ? <>연결됨 · {linkedName}</> : "미연결"}
      </i>
    </button>
  );
}

export function ResidentClaimsPanel() {
  const { data: claims = [], isLoading, isError } = useResidentClaims();
  const approveClaim = useApproveResidentClaim();
  const rejectClaim = useRejectResidentClaim();
  const [building, setBuilding] = useState("");
  const [status, setStatus] = useState<LinkFilter>("all");
  const [selectedClaim, setSelectedClaim] = useState<ResidentClaim | null>(null);
  const [occupancySearch, setOccupancySearch] = useState("");
  const [selectedOccupancy, setSelectedOccupancy] = useState<OrgOccupancyOption | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const occupancyLookup = useOrgOccupancyLookup(selectedClaim !== null);

  const buildings = useMemo(() => Array.from(new Set(
    claims.map((claim) => claim.buildingName).filter((name): name is string => Boolean(name)),
  )).sort((a, b) => a.localeCompare(b, "ko")), [claims]);

  const filteredClaims = useMemo(() => claims.filter((claim) => (
    (!building || claim.buildingName === building)
    && (status === "all" || linkState(claim) === status)
  )), [building, claims, status]);

  const linkedOccupancies = useMemo(() => new Map(
    claims
      .filter((claim) => claim.status === "linked" && claim.occupancyId !== null)
      .map((claim) => [claim.occupancyId as number, claim.kakaoName ?? claim.claimedName ?? "-"]),
  ), [claims]);

  const occupancyOptions = useMemo(() => {
    const query = occupancySearch.trim().toLocaleLowerCase("ko-KR");
    if (!query) return occupancyLookup.data ?? [];
    return (occupancyLookup.data ?? []).filter((option) => (
      `${option.buildingName} ${option.unitNo} ${option.tenantName ?? ""}`
        .toLocaleLowerCase("ko-KR")
        .includes(query)
    ));
  }, [occupancyLookup.data, occupancySearch]);

  const closeLinkModal = () => {
    setSelectedClaim(null);
    setSelectedOccupancy(null);
    setOccupancySearch("");
    setConfirmOpen(false);
  };

  const openLinkModal = (claim: ResidentClaim) => {
    if (claim.status !== "pending") return;
    setSelectedClaim(claim);
    setSelectedOccupancy(null);
    setOccupancySearch("");
    setConfirmOpen(false);
  };

  const approve = async () => {
    if (!selectedClaim || !selectedOccupancy) return;
    try {
      await approveClaim.mutateAsync({
        claimId: selectedClaim.claimId,
        occupancyId: selectedOccupancy.occupancyId,
      });
      toast.success(`${selectedOccupancy.buildingName} ${selectedOccupancy.unitNo}호와 연결했어요`);
      closeLinkModal();
    } catch (error) {
      toast.error(error, "오류가 발생했습니다");
    }
  };

  const reject = async () => {
    if (!selectedClaim) return;
    try {
      await rejectClaim.mutateAsync(selectedClaim.claimId);
      closeLinkModal();
    } catch (error) {
      toast.error(error, "오류가 발생했습니다");
    }
  };

  const isResidentClaimMutationPending = approveClaim.isPending || rejectClaim.isPending;

  return (
    <>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-center gap-2 border-b border-line p-4">
          <h2 className="text-base font-extrabold text-t1">계정 목록</h2>
          <span className="rounded-lg bg-bg px-2.5 py-1 text-xs font-bold text-t3">
            {filteredClaims.length}개
          </span>
        </div>

        <div className="flex flex-col gap-2 border-b border-line2 p-3 sm:flex-row sm:items-center sm:px-4">
          <div className="w-full sm:w-44">
            <Select
              aria-label="건물 전체"
              value={building}
              onChange={(event) => setBuilding(event.target.value)}
              options={[
                { value: "", label: "건물 전체" },
                ...buildings.map((name) => ({ value: name, label: name })),
              ]}
              className="h-10 rounded-lg"
            />
          </div>
          <div className="inline-flex w-fit rounded-xl bg-bg p-1">
            {STATUS_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  status === option.value ? "bg-surface text-t1 shadow-card" : "text-t3 hover:text-t1"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex h-full min-h-[320px] items-center justify-center">
              <Spinner />
            </div>
          ) : isError ? (
            <EmptyState message="오류가 발생했습니다" />
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead className="sticky top-0 z-10 bg-bg">
                <tr className="border-b border-line">
                  {COLUMNS.map((column) => (
                    <th key={column} className="whitespace-nowrap px-3 py-3 text-left text-xs font-bold text-t2 first:pl-4 last:pr-4">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredClaims.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length}>
                      <EmptyState message="검색 결과가 없어요" />
                    </td>
                  </tr>
                ) : filteredClaims.map((claim) => {
                  const state = linkState(claim);
                  const pending = claim.status === "pending";
                  return (
                    <tr
                      key={claim.claimId}
                      role={pending ? "button" : undefined}
                      tabIndex={pending ? 0 : undefined}
                      onClick={() => openLinkModal(claim)}
                      onKeyDown={(event) => {
                        if (pending && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          openLinkModal(claim);
                        }
                      }}
                      className={`border-b border-line2 last:border-0 ${pending ? "cursor-pointer hover:bg-bg focus:bg-bg focus:outline-none" : ""}`}
                    >
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-t1 first:pl-4">{claim.buildingName ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-t1">{claimUnit(claim)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-t1">{claimName(claim)}</td>
                      <td className="num whitespace-nowrap px-3 py-3 text-t1">{claimPhone(claim)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-t1">{claim.kakaoId ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-t1">{claim.kakaoName ?? "-"}</td>
                      <td className="whitespace-nowrap px-3 py-3"><StatusBadge state={state} /></td>
                      <td className="num whitespace-nowrap px-3 py-3 text-t1 last:pr-4">{claimDate(claim)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <Modal
        open={selectedClaim !== null && !confirmOpen}
        onClose={closeLinkModal}
        title="세대 연결"
        className="max-w-xl"
      >
        {selectedClaim && (
          <div>
            <p className="text-xs font-semibold leading-6 text-t3">
              이 카카오 계정을 연결할 세대를 선택해 주세요. 세입자가 입력한 건물·호실이 잘못됐어도 여기서 올바른 세대로 연결됩니다.
            </p>
            <div className="mt-3 rounded-xl bg-bg px-4 py-3 text-sm font-bold text-t2">
              카카오 {selectedClaim.kakaoName ?? "-"}
              <span className="mt-1 block text-xs font-semibold text-t3">
                {selectedClaim.kakaoId ?? "-"} · {claimPhone(selectedClaim)}
              </span>
            </div>
            <div className="mt-3">
              <SearchBar
                value={occupancySearch}
                onChange={setOccupancySearch}
                placeholder="건물명 또는 호실 검색"
              />
            </div>
            <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-line2">
              {occupancyLookup.isLoading ? (
                <Spinner />
              ) : occupancyLookup.isError || occupancyOptions.length === 0 ? (
                <EmptyState message="검색 결과가 없어요" />
              ) : occupancyOptions.map((option) => (
                <OccupancyButton
                  key={option.occupancyId}
                  option={option}
                  selected={selectedOccupancy?.occupancyId === option.occupancyId}
                  linkedName={linkedOccupancies.get(option.occupancyId)}
                  onSelect={() => setSelectedOccupancy(option)}
                />
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button type="button" variant="danger" onClick={reject} disabled={isResidentClaimMutationPending}>
                {rejectClaim.isPending ? "삭제 중…" : "삭제"}
              </Button>
              <Button type="button" variant="ghost" onClick={closeLinkModal} disabled={isResidentClaimMutationPending} className="ml-auto">
                닫기
              </Button>
              <Button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!selectedOccupancy || isResidentClaimMutationPending}
              >
                연결하기
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={confirmOpen && selectedClaim !== null && selectedOccupancy !== null}
        onClose={() => setConfirmOpen(false)}
        title="이 세대로 연결할까요?"
        className="max-w-sm"
      >
        {selectedClaim && selectedOccupancy && (
          <div>
            <p className="text-sm font-semibold leading-6 text-t3">
              <b className="text-t1">{selectedOccupancy.buildingName} {selectedOccupancy.unitNo}호</b>에 카카오 {selectedClaim.kakaoName ?? "-"}({selectedClaim.kakaoId ?? "-"}) 계정을 연결합니다.
              <br />
              연결하면 이 세입자는 해당 호실의 관리비·공지 정보를 열람하게 됩니다.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)} disabled={isResidentClaimMutationPending}>
                취소
              </Button>
              <Button type="button" onClick={approve} disabled={isResidentClaimMutationPending}>
                {approveClaim.isPending ? "연결 중…" : "연결"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
