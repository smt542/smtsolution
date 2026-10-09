"use client";

import { useMemo, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import {
  Button,
  CustomDropdown,
  EmptyState,
  Input,
  Modal,
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

// 정본 #tnTbl 은 `table-layout:auto` 라 컬럼 폭이 더미 데이터 길이대로 나뉜다.
// 그 렌더 비율(뷰포트 1340 실측)을 폭으로 선언해 앱 데이터와 무관하게 맞춘다 —
// 예: 카카오 ID 가 긴 스텁 값이면 auto 로는 170px -> 358px 로 벌어졌다.
const COLUMNS: { label: string; width: string }[] = [
  { label: "건물명", width: "12.02%" },
  { label: "호실", width: "7.41%" },
  { label: "입주자명", width: "9.35%" },
  { label: "연락처", width: "17.88%" },
  { label: "카카오 ID", width: "16.14%" },
  { label: "카카오 이름", width: "11.23%" },
  { label: "연결 상태", width: "11.67%" },
  { label: "연결일", width: "14.31%" },
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
    on: "bg-[#E6F7EE] text-[#0F7B4F]",
    off: "bg-bg text-t3",
    fail: "bg-[#FFF1F1] text-[#F04452]",
  }[state];

  return (
    <span className={`inline-flex items-center rounded-[7px] px-[9px] py-[3px] text-[11.5px] font-bold leading-[normal] ${color}`}>
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
      className={`flex w-full cursor-pointer items-center gap-[10px] border-b border-line2 px-[14px] py-[12px] text-left last:border-0 hover:bg-[#F7F8FA] ${
        selected ? "bg-brand-tint" : "bg-surface"
      }`}
    >
      <b className="text-[13.5px] font-bold leading-[normal] text-t1">{option.buildingName} {option.unitNo}호</b>
      <span className="text-[12px] font-semibold leading-[normal] text-t3">{option.tenantName ?? "-"}</span>
      <i className="ml-auto text-[12px] font-semibold leading-[normal] not-italic text-t3">
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
      const result = await approveClaim.mutateAsync({
        claimId: selectedClaim.claimId,
        occupancyId: selectedOccupancy.occupancyId,
      });
      if (!result.approved) {
        toast.info("이미 연결된 입주자 또는 세대라 연결하지 않았어요");
        closeLinkModal();
        return;
      }
      toast.success(`${selectedOccupancy.buildingName} ${selectedOccupancy.unitNo}호와 연결했어요`);
      // 승인은 확정 — 안내 문자 미발송은 비차단 경고만 띄운다.
      if (!result.notified) toast.info("연결은 완료됐지만 안내 문자를 보내지 못했어요");
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
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-surface shadow-card">
        <div className="flex flex-none items-center gap-[10px] border-b border-line2 px-[18px] py-[15px]">
          <h2 className="text-[15px] font-extrabold leading-[normal] text-t1">계정 목록</h2>
          <span className="inline-flex items-center rounded-[7px] bg-bg px-[9px] py-[3px] text-[12px] font-bold leading-[1.4] text-t3">
            {filteredClaims.length}개
          </span>
        </div>

        <div className="flex flex-none items-center gap-[10px] border-b border-line2 px-[16px] py-[12px]">
          <div className="w-[170px] flex-none [&_.uc-dd-btn]:h-[40px] [&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:justify-between [&_.uc-dd-btn]:rounded-[11px] [&_.uc-dd-btn]:px-[10px] [&_.uc-dd-btn]:text-[14px] [&_.uc-dd-btn]:font-semibold [&_.uc-dd-btn]:leading-[normal] [&_.uc-dd-lbl]:text-[13.5px] [&_.uc-dd-btn_svg]:size-[14px] [&_.uc-dd-btn_svg]:text-t3">
            <CustomDropdown
              chevron="rotate"
              ariaLabel="건물 전체"
              value={building}
              onChange={setBuilding}
              options={[
                { value: "", label: "건물 전체" },
                ...buildings.map((name) => ({ value: name, label: name })),
              ]}
              variant="field"
              position="fixed"
            />
          </div>
          <div className="inline-flex flex-none items-center gap-[2px] rounded-[9px] bg-[#EDF0F3] p-[3px]">
            {STATUS_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatus(option.value)}
                className={`whitespace-nowrap rounded-[7px] px-[12px] py-[6px] text-[12.5px] font-bold leading-[normal] ${
                  status === option.value ? "bg-surface text-t1 shadow-[0_1px_3px_rgba(23,31,40,0.1)]" : "text-t3"
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
            <table className="w-full table-fixed border-collapse">
              <thead className="sticky top-0 z-10 bg-[#FBFCFD]">
                <tr>
                  {COLUMNS.map((column) => (
                    <th
                      key={column.label}
                      style={{ width: column.width }}
                      className="whitespace-nowrap border-b border-line bg-[#FBFCFD] px-[12px] py-[11px] text-left text-[12px] font-bold leading-[normal] text-t3 first:pl-[16px] last:pr-[16px]"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredClaims.length === 0 ? (
                  <tr className="last:[&>td]:border-b-0">
                    <td colSpan={COLUMNS.length} className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-line2 px-[12px] py-[12px] text-[13px] font-medium leading-[normal] text-t1 first:pl-[16px] last:pr-[16px]">
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
                      /* 정본 `.hf-tbl tbody tr:hover td{background:#FBFCFD}` 는 모든 행에 걸린다
                         (#tnTbl 의 tr 배경 #FAFBFC 는 td 배경에 가려 보이지 않는다).
                         cursor/focus 는 실제로 누를 수 있는 매핑실패 행에만 준다. */
                      className={`last:[&>td]:border-b-0 hover:[&>td]:bg-row-hover ${pending ? "cursor-pointer focus:outline-none focus:[&>td]:bg-row-hover" : ""}`}
                    >
                      <td title={claim.buildingName ?? "-"} className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-line2 px-[12px] py-[12px] text-[13px] font-medium leading-[normal] text-t1 first:pl-[16px] last:pr-[16px]">{claim.buildingName ?? "-"}</td>
                      <td title={claimUnit(claim)} className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-line2 px-[12px] py-[12px] text-[13px] font-medium leading-[normal] text-t1 first:pl-[16px] last:pr-[16px]">{claimUnit(claim)}</td>
                      <td title={claimName(claim)} className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-line2 px-[12px] py-[12px] text-[13px] font-medium leading-[normal] text-t1 first:pl-[16px] last:pr-[16px]">{claimName(claim)}</td>
                      <td title={claimPhone(claim)} className="num overflow-hidden text-ellipsis whitespace-nowrap border-b border-line2 px-[12px] py-[12px] text-[13px] font-medium leading-[normal] text-t1 first:pl-[16px] last:pr-[16px]">{claimPhone(claim)}</td>
                      <td title={claim.kakaoId ?? "-"} className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-line2 px-[12px] py-[12px] text-[13px] font-medium leading-[normal] text-t1 first:pl-[16px] last:pr-[16px]">{claim.kakaoId ?? "-"}</td>
                      <td title={claim.kakaoName ?? "-"} className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-line2 px-[12px] py-[12px] text-[13px] font-medium leading-[normal] text-t1 first:pl-[16px] last:pr-[16px]">{claim.kakaoName ?? "-"}</td>
                      <td className="overflow-hidden text-ellipsis whitespace-nowrap border-b border-line2 px-[12px] py-[12px] text-[13px] font-medium leading-[normal] text-t1 first:pl-[16px] last:pr-[16px]"><StatusBadge state={state} /></td>
                      <td title={claimDate(claim)} className="num overflow-hidden text-ellipsis whitespace-nowrap border-b border-line2 px-[12px] py-[12px] text-[13px] font-medium leading-[normal] text-t1 first:pl-[16px] last:pr-[16px]">{claimDate(claim)}</td>
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
        className="!w-[92vw] max-h-[82vh] max-w-[520px] flex flex-col !rounded-[18px] bg-surface !p-[20px_22px_18px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.4)] [&>h2]:flex-none [&>h2]:text-[17px] [&>h2]:font-extrabold [&>h2]:leading-[normal] [&>h2]:tracking-[-0.02em]"
        bodyClassName="mt-[8px] flex min-h-0 flex-1 flex-col"
        overlayClassName="z-[200] bg-[rgba(23,31,40,0.45)]"
      >
        {selectedClaim && (
          <div className="flex min-h-0 flex-1 flex-col">
            <p className="flex-none text-[12.5px] font-semibold leading-[1.65] text-t3">
              이 카카오 계정을 연결할 세대를 선택해 주세요. 세입자가 입력한 건물·호실이 잘못됐어도 여기서 올바른 세대로 연결됩니다.
            </p>
            <div className="mt-[12px] flex-none rounded-[11px] bg-bg px-[14px] py-[12px] text-[13px] font-bold leading-[normal] text-t2">
              카카오 {selectedClaim.kakaoName ?? "-"}
              <span className="num mt-[4px] block text-[12px] font-semibold leading-[normal] text-t3">
                {selectedClaim.kakaoId ?? "-"} · {claimPhone(selectedClaim)}
              </span>
            </div>
            <Input
              type="text"
              value={occupancySearch}
              onChange={(event) => setOccupancySearch(event.target.value)}
              placeholder="건물명 또는 호실 검색"
              className="mt-[12px] !h-[38px] flex-none !rounded-[10px] border border-line bg-surface !px-[12px] !text-[13px] leading-[normal] text-t1 placeholder:text-t4 focus:border-brand focus:outline-none"
            />
            <div className="mt-[10px] min-h-0 flex-1 overflow-auto rounded-[12px] border border-line2">
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
            <div className="mt-[16px] flex flex-none items-center gap-[8px]">
              {/* 정본 .lk-a 에는 닫기·연결하기만 있다. 삭제(reject RPC)는 앱 전용이라
                  정본 38px 지오메트리만 따르고 파괴적 동작 표시는 danger 를 유지한다. */}
              <Button type="button" variant="danger" onClick={reject} disabled={isResidentClaimMutationPending} className="!h-[38px] !rounded-[10px] !px-[14px] !text-[13px] leading-[normal] !shadow-none">
                삭제
              </Button>
              <Button type="button" variant="ghost" onClick={closeLinkModal} disabled={isResidentClaimMutationPending} className="!h-[38px] !rounded-[10px] !px-[14px] !text-[13px] leading-[normal] hover:bg-surface">
                닫기
              </Button>
              <Button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={!selectedOccupancy || isResidentClaimMutationPending}
                className="ml-auto !h-[38px] !rounded-[10px] border border-brand bg-brand !px-[14px] !text-[13px] leading-[normal] !shadow-none hover:bg-brand disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-t4"
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
        className="max-w-sm [&>h2]:leading-[normal]"
      >
        {selectedClaim && selectedOccupancy && (
          <div>
            <p className="text-[13px] font-semibold leading-[normal] text-t3">
              <b className="leading-[normal] text-t1">{selectedOccupancy.buildingName} {selectedOccupancy.unitNo}호</b>에 카카오 {selectedClaim.kakaoName ?? "-"}({selectedClaim.kakaoId ?? "-"}) 계정을 연결합니다.
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
