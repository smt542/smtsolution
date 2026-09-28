"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CloseIcon } from "@/components/icons";
import { MaskedPhone } from "@/components/common/MaskedPhone";
import type { Building } from "@/hooks/reactquery/buildings";
import { useSettlementInquiry } from "@/hooks/reactquery/movingSettlement";
import {
  useReceiptPaymentStatusPeriods,
  type ReceiptPaymentRow,
} from "@/hooks/reactquery/receipts";
import { computeLateFeeForPeriod } from "@/lib/billing/lateFee";
import type { Period } from "@/lib/billing/period";
import { formatCurrency, unitLabel } from "../receiptFormat";
import {
  SearchResultTable,
  type SearchColumn,
  type SearchResultRow,
} from "./search/SearchResultTable";
import { SearchSection } from "./search/SearchSection";
import { ReportDateField } from "./report-controls/ReportDateField";
import { Button, Input } from "@/components/common";

type BuildingLite = Pick<
  Building,
  "id" | "code" | "name" | "address" | "ownerName" | "ownerPhone"
>;

type KeywordSearch = { name: string; phone: string; dongho: string };

const PLACEHOLDER = "조회 버튼을 눌러 주세요";
const NO_RESULT = "조회 결과가 없어요";
const RESULT_LIMIT = 100;

const CHARGE_COLUMNS: SearchColumn[] = [
  { label: "코드", width: 52 },
  { label: "빌라명칭", minWidth: 104, strong: true },
  { label: "호", width: 52 },
  { label: "세입자명", minWidth: 78 },
  { label: "년월", width: 72 },
  { label: "당월계", minWidth: 82, align: "right", strong: true },
  { label: "납기내금액", minWidth: 88, align: "right", strong: true },
  { label: "납기후금액", minWidth: 88, align: "right", strong: true },
  { label: "수납일자", minWidth: 92 },
];

const SETTLEMENT_COLUMNS: SearchColumn[] = [
  { label: "코드", width: 52 },
  { label: "빌라명칭", minWidth: 110, strong: true },
  { label: "호수", width: 56 },
  { label: "년월", width: 76 },
  { label: "일", width: 44 },
  { label: "금액", minWidth: 90, align: "right", strong: true },
  { label: "수납일", minWidth: 92 },
];

const TENANT_COLUMNS: SearchColumn[] = [
  { label: "이름", minWidth: 74, strong: true },
  { label: "입금자", minWidth: 74 },
  { label: "코드", width: 52 },
  { label: "빌라명", minWidth: 104 },
  { label: "호수", width: 56 },
  { label: "핸드폰", minWidth: 118 },
  { label: "년월", width: 72 },
  { label: "납기내금액", minWidth: 88, align: "right", strong: true },
  { label: "수납일자", minWidth: 92 },
];

const OWNER_COLUMNS: SearchColumn[] = [
  { label: "코드", width: 52 },
  { label: "동명칭", minWidth: 100, strong: true },
  { label: "주소", minWidth: 150 },
  { label: "거래처명", minWidth: 96 },
  { label: "구분", width: 64 },
  { label: "건물주명", minWidth: 88 },
  { label: "연락처", minWidth: 118 },
];

const pad2 = (value: number) => String(value).padStart(2, "0");

/** period(YYYY-MM-01) → 해당 월 1일 ~ 말일 범위 */
function monthRange(period: Period): { from: string; to: string } {
  const ym = period.slice(0, 7);
  const [year, month] = ym.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${pad2(lastDay)}` };
}

const toYm = (value: string | null | undefined) =>
  value ? value.slice(0, 7) : "-";
const toDate = (value: string | null | undefined) =>
  value ? value.slice(0, 10).replaceAll("-", ".") : "-";
const toDay = (value: string | null | undefined) =>
  value && value.length >= 10 ? value.slice(8, 10) : "-";
const toUnit = (row: { dong?: string | null; unitNo?: string | null }) => {
  const value = unitLabel(row);
  return value ? value.replace(/호$/, "") : "-";
};
const norm = (value: string | null | undefined) => (value ?? "").toLocaleLowerCase("ko-KR");
const digitsOf = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

export function UnifiedSearchModal({
  open,
  ...props
}: {
  open: boolean;
  onClose: () => void;
  orgId: number;
  buildings: BuildingLite[];
  receiptRows: ReceiptPaymentRow[];
  period: Period;
  onJump: (buildingId: number, unitId: number | null) => void;
}) {
  // 닫힐 때 언마운트해 재오픈 시 조회 상태가 자연스럽게 초기화되도록 본문을 분리한다.
  if (!open) return null;
  return <UnifiedSearchModalBody {...props} />;
}

function UnifiedSearchModalBody({
  onClose,
  orgId,
  buildings,
  receiptRows,
  period,
  onJump,
}: {
  onClose: () => void;
  orgId: number;
  buildings: BuildingLite[];
  receiptRows: ReceiptPaymentRow[];
  period: Period;
  onJump: (buildingId: number, unitId: number | null) => void;
}) {
  const titleId = useId();
  const defaults = useMemo(() => monthRange(period), [period]);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [amountInput, setAmountInput] = useState("");
  const [amountSearch, setAmountSearch] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [donghoInput, setDonghoInput] = useState("");
  const [keyword, setKeyword] = useState<KeywordSearch | null>(null);

  // Escape·스크롤 잠금 (ComplaintDialog 공통 패턴)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const validRange = Boolean(from) && Boolean(to) && from <= to;
  const periods = useMemo(() => {
    if (!validRange) return [];
    const first = new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, 1);
    const last = new Date(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, 1);
    const result: string[] = [];
    const cursor = new Date(first);
    while (cursor <= last) {
      result.push(`${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}-01`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result.length > 12 ? result.slice(-12) : result;
  }, [from, to, validRange]);

  const receiptPeriods = useReceiptPaymentStatusPeriods(
    orgId,
    periods,
    amountSearch !== null && validRange,
  );
  const { data: settlementResult } = useSettlementInquiry({
    type: "all",
    from: validRange ? from : "",
    to: validRange ? to : "",
    pageSize: 200,
  });
  const settlements = useMemo(() => settlementResult?.rows ?? [], [settlementResult]);

  const codeByBuilding = useMemo(
    () => new Map(buildings.map((building) => [building.id, building.code])),
    [buildings],
  );

  const amountDigits = amountSearch ? digitsOf(amountSearch) : "";

  const chargeRows: SearchResultRow[] = useMemo(() => {
    if (amountSearch === null) return [];
    return receiptPeriods.periods
      .flatMap(({ period: rowPeriod, rows }) =>
        rows
          .filter((row): row is ReceiptPaymentRow & { charged: number } =>
            row.charged !== null &&
            (amountDigits.length === 0 || String(row.charged).includes(amountDigits)),
          )
          .map((row) => ({ period: rowPeriod, row })),
      )
      .sort((left, right) => right.period.localeCompare(left.period))
      .slice(0, RESULT_LIMIT)
      .map(({ period: rowPeriod, row }) => {
        const [year, month] = rowPeriod.slice(0, 7).split("-").map(Number);
        const postDueFee = computeLateFeeForPeriod(
          {
            period: rowPeriod,
            unpaidPrincipal: Math.max(row.unpaid ?? 0, 0),
            dueDate: (row.dueDate ?? rowPeriod).slice(0, 10),
          },
          [],
          year,
          month,
        ).postDueFee;
        return {
          key: `charge-${rowPeriod}-${row.buildingId}-${row.unitId}`,
          buildingId: row.buildingId,
          unitId: row.unitId,
          cells: [
            codeByBuilding.get(row.buildingId) ?? "-",
            row.buildingName,
            toUnit(row),
            row.tenantName ?? "-",
            toYm(rowPeriod),
            formatCurrency(row.charged),
            formatCurrency(row.charged),
            formatCurrency(row.charged + postDueFee),
            toDate(row.lastPaymentDate),
          ],
        };
      });
  }, [amountSearch, amountDigits, receiptPeriods.periods, codeByBuilding]);

  const settlementRows: SearchResultRow[] = useMemo(() => {
    if (amountSearch === null) return [];
    return settlements
      .filter(
        (row) =>
          // 정본 amtOk = !qa || … — 금액이 비어 있으면 금액 없는 정산도 전부 보인다.
          amountDigits.length === 0 ||
          (row.settlementAmount != null && String(row.settlementAmount).includes(amountDigits)),
      )
      .slice(0, RESULT_LIMIT)
      .map((row) => ({
        key: `settle-${row.settlementId}`,
        buildingId: row.buildingId,
        unitId: row.unitId,
        cells: [
          codeByBuilding.get(row.buildingId) ?? "-",
          row.buildingName,
          toUnit(row),
          toYm(row.moveOutDate),
          toDay(row.moveOutDate),
          formatCurrency(row.settlementAmount),
          toDate(row.processedAt),
        ],
      }));
  }, [amountSearch, amountDigits, settlements, codeByBuilding]);

  // 정본 applyQ: has = sB && (qn || qt || qd) — 전화번호는 숫자만 조건으로 친다. 조건이 없으면 표를 비운다.
  const hasKeyword = Boolean(keyword && (keyword.name || digitsOf(keyword.phone) || keyword.dongho));

  const tenantRows: SearchResultRow[] = useMemo(() => {
    if (!keyword || !hasKeyword) return [];
    const name = norm(keyword.name);
    const phone = digitsOf(keyword.phone);
    const dongho = norm(keyword.dongho);
    const matches = (row: ReceiptPaymentRow) => {
      const nameMatches =
        name.length === 0 || norm(row.tenantName).includes(name) || norm(row.payerName).includes(name);
      const phoneMatches = phone.length === 0 || digitsOf(row.phone).includes(phone);
      const donghoMatches =
        dongho.length === 0 ||
        norm(`${codeByBuilding.get(row.buildingId) ?? ""} ${unitLabel(row)} ${row.buildingName}`).includes(
          dongho,
        );
      return nameMatches && phoneMatches && donghoMatches;
    };
    return receiptRows
      .filter(matches)
      .slice(0, RESULT_LIMIT)
      .map((row) => ({
        key: `tenant-${row.buildingId}-${row.unitId}`,
        buildingId: row.buildingId,
        unitId: row.unitId,
        cells: [
          row.tenantName ?? "-",
          row.payerName ?? "-",
          codeByBuilding.get(row.buildingId) ?? "-",
          row.buildingName,
          toUnit(row),
          row.phone && row.occupancyId ? (
            <span className="[&_button]:py-0 [&_button]:leading-[normal]">
              <MaskedPhone
                value={row.phone}
                kind="phone"
                reveal={{ targetKind: "occupancy", targetId: row.occupancyId, field: "phone" }}
              />
            </span>
          ) : (
            "-"
          ),
          toYm(period),
          formatCurrency(row.charged),
          toDate(row.lastPaymentDate),
        ],
      }));
  }, [keyword, hasKeyword, receiptRows, period, codeByBuilding]);

  const ownerRows: SearchResultRow[] = useMemo(() => {
    if (!keyword || !hasKeyword) return [];
    const name = norm(keyword.name);
    const phone = digitsOf(keyword.phone);
    const dongho = norm(keyword.dongho);
    const matches = (building: BuildingLite) => {
      const nameMatches = name.length === 0 || norm(building.ownerName).includes(name);
      const phoneMatches = phone.length === 0 || digitsOf(building.ownerPhone).includes(phone);
      const donghoMatches =
        dongho.length === 0 || norm(`${building.code} ${building.name}`).includes(dongho);
      return nameMatches && phoneMatches && donghoMatches;
    };
    return buildings
      .filter(matches)
      .slice(0, RESULT_LIMIT)
      .map((building) => ({
        key: `owner-${building.id}`,
        buildingId: building.id,
        unitId: null,
        cells: [
          building.code || "-",
          building.name,
          building.address ?? "-",
          "-", // 거래처명 — 현재 조회 데이터 소스 없음
          "-", // 구분 — 현재 조회 데이터 소스 없음
          building.ownerName ?? "-",
          building.ownerPhone ? (
            <span className="[&_button]:py-0 [&_button]:leading-[normal]">
              <MaskedPhone
                value={building.ownerPhone}
                kind="phone"
                reveal={{ targetKind: "building", targetId: building.id, field: "owner_phone" }}
              />
            </span>
          ) : (
            "-"
          ),
        ],
      }));
  }, [keyword, hasKeyword, buildings]);

  const runAmount = () => {
    setAmountSearch(amountInput.trim());
  };
  const runKeyword = () => {
    setKeyword({
      name: nameInput.trim(),
      phone: phoneInput.trim(),
      dongho: donghoInput.trim(),
    });
  };
  const handleJump = (buildingId: number, unitId: number | null) => {
    onJump(buildingId, unitId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-[88vh] w-[min(1180px,96%)] flex-col rounded-[20px] bg-surface px-[20px] pb-[14px] pt-[18px] leading-[normal] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* 조회 구간 */}
        <div className="mb-[12px] flex shrink-0 items-center gap-[9px]">
          <h2
            id={titleId}
            className="flex-none whitespace-nowrap text-[16.5px] font-extrabold tracking-[-0.02em] text-t1"
          >
            조회 구간
          </h2>
          <ReportDateField
            type="date"
            size="md"
            ariaLabel="조회 시작일"
            value={from}
            max={to || undefined}
            onValueChange={setFrom}
            className="w-[150px]"
          />
          <span className="flex-none text-[16.5px] font-extrabold tracking-[-0.02em] text-t3">~</span>
          <ReportDateField
            type="date"
            size="md"
            ariaLabel="조회 종료일"
            value={to}
            min={from || undefined}
            onValueChange={setTo}
            className="w-[150px]"
          />
          <div className="flex-1" />
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="flex size-[26px] shrink-0 items-center justify-center rounded-[8px] border border-line bg-surface text-t3 transition-[border-color,background] duration-[120ms] hover:border-[#C9D0D8] hover:bg-[#F7F9FA] hover:text-t2"
          >
            <CloseIcon className="size-[14px]" aria-hidden="true" />
          </button>
        </div>

        {/* 결과 영역 */}
        <div className="flex min-h-0 flex-1 flex-col gap-[12px]">
          <SearchSection
            title="금액으로 찾기"
            actions={
              <>
                <Input
                  size="38-13"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runAmount();
                  }}
                  inputMode="numeric"
                  placeholder="금액"
                  aria-label="금액"
                  className="w-[150px] min-w-0 shrink font-medium"
                />
                <Button
                  size="md"
                  variant="ghost"
                  type="button"
                  aria-label="금액으로 조회"
                  onClick={runAmount}
                >
                  조회
                </Button>
              </>
            }
          >
            <SearchResultTable
              title="청구금액 조회"
              columns={CHARGE_COLUMNS}
              rows={chargeRows}
              placeholder={amountSearch !== null ? NO_RESULT : PLACEHOLDER}
              onJump={handleJump}
            />
            <SearchResultTable
              title="이사정산 금액조회"
              columns={SETTLEMENT_COLUMNS}
              rows={settlementRows}
              placeholder={amountSearch !== null ? NO_RESULT : PLACEHOLDER}
              onJump={handleJump}
            />
          </SearchSection>

          <SearchSection
            title="입금자명 · 전화번호 · 동호로 찾기"
            actions={
              <>
                <Input
                  size="38-13"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runKeyword();
                  }}
                  placeholder="입금자명 (세입자 · 건물주)"
                  aria-label="입금자명"
                  className="w-[202px] min-w-0 shrink font-medium"
                />
                <Button
                  size="md"
                  variant="ghost"
                  type="button"
                  aria-label="입금자명으로 조회"
                  onClick={runKeyword}
                >
                  조회
                </Button>
                <Input
                  size="38-13"
                  value={phoneInput}
                  onChange={(event) => setPhoneInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runKeyword();
                  }}
                  inputMode="tel"
                  placeholder="전화번호"
                  aria-label="전화번호"
                  className="w-[180px] min-w-0 shrink font-medium"
                />
                <Button
                  size="md"
                  variant="ghost"
                  type="button"
                  aria-label="전화번호로 조회"
                  onClick={runKeyword}
                >
                  조회
                </Button>
                <Input
                  size="38-13"
                  value={donghoInput}
                  onChange={(event) => setDonghoInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runKeyword();
                  }}
                  placeholder="동호 (코드 또는 호수)"
                  aria-label="동호"
                  className="w-[190px] min-w-0 shrink font-medium"
                />
                <Button
                  size="md"
                  variant="ghost"
                  type="button"
                  aria-label="동호로 조회"
                  onClick={runKeyword}
                >
                  조회
                </Button>
              </>
            }
          >
            <SearchResultTable
              title="세입자 조회"
              columns={TENANT_COLUMNS}
              rows={tenantRows}
              placeholder={
                keyword ? (hasKeyword ? NO_RESULT : "검색 조건을 입력해 주세요") : PLACEHOLDER
              }
              onJump={handleJump}
            />
            <SearchResultTable
              title="건물주 조회"
              columns={OWNER_COLUMNS}
              rows={ownerRows}
              placeholder={
                keyword ? (hasKeyword ? NO_RESULT : "검색 조건을 입력해 주세요") : PLACEHOLDER
              }
              onJump={handleJump}
              clickable={false}
            />
          </SearchSection>
        </div>

        {/* 닫기 */}
        <div className="flex shrink-0 justify-end gap-[8px] pt-[11px]">
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
          >
            닫기
          </Button>
        </div>
      </section>
    </div>
  );
}
