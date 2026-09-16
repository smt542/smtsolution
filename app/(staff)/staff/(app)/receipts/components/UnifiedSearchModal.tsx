"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CloseIcon } from "@/components/icons";
import type { Building } from "@/hooks/reactquery/buildings";
import { useSettlementInquiry } from "@/hooks/reactquery/movingSettlement";
import type { ReceiptPaymentRow } from "@/hooks/reactquery/receipts";
import type { Period } from "@/lib/billing/period";
import { formatCurrency, formatDate, unitLabel } from "../receiptFormat";
import {
  SearchResultTable,
  type SearchColumn,
  type SearchResultRow,
} from "./search/SearchResultTable";
import { SearchSection } from "./search/SearchSection";
import { ReportDateField } from "./report-controls/ReportDateField";

type BuildingLite = Pick<
  Building,
  "id" | "code" | "name" | "address" | "ownerName" | "ownerPhone"
>;

type KeywordField = "name" | "phone" | "dongho";
type KeywordSearch = { field: KeywordField; value: string };

const PLACEHOLDER = "조회 버튼을 눌러 주세요";
const NO_RESULT = "조회 결과가 없어요";
const RESULT_LIMIT = 100;

const CHARGE_COLUMNS: SearchColumn[] = [
  { label: "코드" },
  { label: "빌라명칭" },
  { label: "호" },
  { label: "세입자명" },
  { label: "년월" },
  { label: "당월계", align: "right" },
  { label: "납기내금액", align: "right" },
  { label: "납기후금액", align: "right" },
  { label: "수납일자" },
];

const SETTLEMENT_COLUMNS: SearchColumn[] = [
  { label: "코드" },
  { label: "빌라명칭" },
  { label: "호수" },
  { label: "년월" },
  { label: "일" },
  { label: "금액", align: "right" },
  { label: "수납일" },
];

const TENANT_COLUMNS: SearchColumn[] = [
  { label: "이름" },
  { label: "입금자" },
  { label: "코드" },
  { label: "빌라명" },
  { label: "호수" },
  { label: "핸드폰" },
  { label: "년월" },
  { label: "납기내금액", align: "right" },
  { label: "수납일자" },
];

const OWNER_COLUMNS: SearchColumn[] = [
  { label: "코드" },
  { label: "동명칭" },
  { label: "주소" },
  { label: "거래처명" },
  { label: "구분" },
  { label: "건물주명" },
  { label: "연락처" },
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
  value ? value.slice(0, 7).replace("-", ".") : "-";
const toDay = (value: string | null | undefined) =>
  value && value.length >= 10 ? value.slice(8, 10) : "-";
const norm = (value: string | null | undefined) => (value ?? "").toLocaleLowerCase("ko-KR");
const digitsOf = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

const FIELD_BASE =
  "h-[38px] rounded-[10px] border border-line bg-surface px-[11px] text-[13px] text-t1 placeholder:text-t4 outline-none focus:border-blue";
const SEARCH_BTN =
  "h-[38px] shrink-0 rounded-[10px] border border-line bg-surface px-[15px] text-[13.5px] font-bold text-t2 hover:bg-bg";

export function UnifiedSearchModal({
  open,
  ...props
}: {
  open: boolean;
  onClose: () => void;
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
  buildings,
  receiptRows,
  period,
  onJump,
}: {
  onClose: () => void;
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
    if (!amountSearch || amountDigits.length === 0) return [];
    return receiptRows
      .filter((row) => row.charged != null && String(row.charged).includes(amountDigits))
      .slice(0, RESULT_LIMIT)
      .map((row) => ({
        key: `charge-${row.buildingId}-${row.unitId}`,
        buildingId: row.buildingId,
        unitId: row.unitId,
        cells: [
          codeByBuilding.get(row.buildingId) ?? "-",
          row.buildingName,
          unitLabel(row) || "-",
          row.tenantName ?? "-",
          toYm(period),
          formatCurrency(row.charged),
          formatCurrency(row.charged),
          formatCurrency(row.charged),
          formatDate(row.lastPaymentDate),
        ],
      }));
  }, [amountSearch, amountDigits, receiptRows, period, codeByBuilding]);

  const settlementRows: SearchResultRow[] = useMemo(() => {
    if (!amountSearch || amountDigits.length === 0) return [];
    return settlements
      .filter(
        (row) => row.settlementAmount != null && String(row.settlementAmount).includes(amountDigits),
      )
      .slice(0, RESULT_LIMIT)
      .map((row) => ({
        key: `settle-${row.settlementId}`,
        buildingId: row.buildingId,
        unitId: row.unitId,
        cells: [
          codeByBuilding.get(row.buildingId) ?? "-",
          row.buildingName,
          unitLabel(row) || "-",
          toYm(row.moveOutDate),
          toDay(row.moveOutDate),
          formatCurrency(row.settlementAmount),
          formatDate(row.processedAt),
        ],
      }));
  }, [amountSearch, amountDigits, settlements, codeByBuilding]);

  const tenantRows: SearchResultRow[] = useMemo(() => {
    if (!keyword) return [];
    const nv = norm(keyword.value);
    const dv = digitsOf(keyword.value);
    const matches = (row: ReceiptPaymentRow) => {
      if (keyword.field === "name") {
        return norm(row.tenantName).includes(nv) || norm(row.payerName).includes(nv);
      }
      if (keyword.field === "phone") {
        return dv.length > 0 && digitsOf(row.phone).includes(dv);
      }
      return (
        norm(codeByBuilding.get(row.buildingId)).includes(nv) || norm(unitLabel(row)).includes(nv)
      );
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
          unitLabel(row) || "-",
          row.phone ?? "-",
          toYm(period),
          formatCurrency(row.charged),
          formatDate(row.lastPaymentDate),
        ],
      }));
  }, [keyword, receiptRows, period, codeByBuilding]);

  const ownerRows: SearchResultRow[] = useMemo(() => {
    if (!keyword) return [];
    const nv = norm(keyword.value);
    const dv = digitsOf(keyword.value);
    const matches = (building: BuildingLite) => {
      if (keyword.field === "name") {
        return norm(building.ownerName).includes(nv) || norm(building.name).includes(nv);
      }
      if (keyword.field === "phone") {
        return dv.length > 0 && digitsOf(building.ownerPhone).includes(dv);
      }
      return norm(building.code).includes(nv) || norm(building.name).includes(nv);
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
          building.ownerPhone ?? "-",
        ],
      }));
  }, [keyword, buildings]);

  const runAmount = () => {
    const value = amountInput.trim();
    if (value) setAmountSearch(value);
  };
  const runKeyword = (field: KeywordField, raw: string) => {
    const value = raw.trim();
    if (value) setKeyword({ field, value });
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
        className="flex h-[801px] max-h-[calc(100vh-32px)] w-full max-w-[1180px] flex-col rounded-[20px] bg-surface px-[20px] pb-[14px] pt-[18px] shadow-pop"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* 조회 구간 */}
        <div className="flex flex-wrap items-center gap-[9px] pb-3">
          <h2
            id={titleId}
            className="whitespace-nowrap text-[16.5px] font-extrabold tracking-[-0.33px] text-t1"
          >
            조회 구간
          </h2>
          <ReportDateField
            type="date"
            ariaLabel="조회 시작일"
            value={from}
            max={to || undefined}
            onValueChange={setFrom}
            className="w-[150px]"
          />
          <span className="text-[16.5px] font-extrabold text-t3">~</span>
          <ReportDateField
            type="date"
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
            className="flex size-[26px] shrink-0 items-center justify-center rounded-[8px] border border-line bg-surface text-t3 hover:bg-bg hover:text-t1"
          >
            <CloseIcon className="size-[14px]" aria-hidden="true" />
          </button>
        </div>

        {/* 결과 영역 */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          <SearchSection
            title="금액으로 찾기"
            actions={
              <>
                <input
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runAmount();
                  }}
                  inputMode="numeric"
                  placeholder="금액"
                  aria-label="금액"
                  className={`${FIELD_BASE} w-[150px]`}
                />
                <button
                  type="button"
                  aria-label="금액으로 조회"
                  onClick={runAmount}
                  className={SEARCH_BTN}
                >
                  조회
                </button>
              </>
            }
          >
            <SearchResultTable
              title="청구금액 조회"
              columns={CHARGE_COLUMNS}
              rows={chargeRows}
              placeholder={amountSearch ? NO_RESULT : PLACEHOLDER}
              onJump={handleJump}
            />
            <SearchResultTable
              title="이사정산 금액조회"
              columns={SETTLEMENT_COLUMNS}
              rows={settlementRows}
              placeholder={amountSearch ? NO_RESULT : PLACEHOLDER}
              onJump={handleJump}
            />
          </SearchSection>

          <SearchSection
            title="입금자명 · 전화번호 · 동호로 찾기"
            actions={
              <>
                <input
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runKeyword("name", nameInput);
                  }}
                  placeholder="입금자명 (세입자 · 건물주)"
                  aria-label="입금자명"
                  className={`${FIELD_BASE} w-[200px]`}
                />
                <button
                  type="button"
                  aria-label="입금자명으로 조회"
                  onClick={() => runKeyword("name", nameInput)}
                  className={SEARCH_BTN}
                >
                  조회
                </button>
                <input
                  value={phoneInput}
                  onChange={(event) => setPhoneInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runKeyword("phone", phoneInput);
                  }}
                  inputMode="tel"
                  placeholder="전화번호"
                  aria-label="전화번호"
                  className={`${FIELD_BASE} w-[160px]`}
                />
                <button
                  type="button"
                  aria-label="전화번호로 조회"
                  onClick={() => runKeyword("phone", phoneInput)}
                  className={SEARCH_BTN}
                >
                  조회
                </button>
                <input
                  value={donghoInput}
                  onChange={(event) => setDonghoInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runKeyword("dongho", donghoInput);
                  }}
                  placeholder="동호 (코드 또는 호수)"
                  aria-label="동호"
                  className={`${FIELD_BASE} w-[180px]`}
                />
                <button
                  type="button"
                  aria-label="동호로 조회"
                  onClick={() => runKeyword("dongho", donghoInput)}
                  className={SEARCH_BTN}
                >
                  조회
                </button>
              </>
            }
          >
            <SearchResultTable
              title="세입자 조회"
              columns={TENANT_COLUMNS}
              rows={tenantRows}
              placeholder={keyword ? NO_RESULT : PLACEHOLDER}
              onJump={handleJump}
            />
            <SearchResultTable
              title="건물주 조회"
              columns={OWNER_COLUMNS}
              rows={ownerRows}
              placeholder={keyword ? NO_RESULT : PLACEHOLDER}
              onJump={handleJump}
            />
          </SearchSection>
        </div>

        {/* 닫기 */}
        <div className="flex justify-end pt-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 items-center rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold text-t2 hover:bg-bg"
          >
            닫기
          </button>
        </div>
      </section>
    </div>
  );
}
