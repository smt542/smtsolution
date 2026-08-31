"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Checkbox, EmptyState, Select } from "@/components/common";
import {
  useBankPayments,
  useRecordBankPayments,
  type PaymentRow,
} from "@/hooks/reactquery/payments";
import {
  guessColumns,
  parseBankWorkbook,
  toDeposits,
  type ColumnMapping,
  type Deposit,
} from "@/lib/payments/bankParse";
import {
  matchDeposits,
  type MatchedDeposit,
  type MatchUnit,
} from "@/lib/payments/match";
import { formatWon } from "@/lib/format";
import { ComplaintDialog } from "../ComplaintDialog";
import { FileDropzone } from "./FileDropzone";

interface BankImportModalProps {
  open: boolean;
  buildingId: number;
  period: string;
  rows: PaymentRow[];
  onClose: () => void;
}

type Stage = "select" | "map" | "preview";
type MappingKey = keyof ColumnMapping;
type MatchedPreview = MatchedDeposit & { isDuplicate: boolean };

const MAPPING_FIELDS: { key: MappingKey; label: string }[] = [
  { key: "customerNo", label: "고객번호 열" },
  { key: "name", label: "입금자명 열" },
  { key: "amount", label: "입금액 열" },
  { key: "paidAt", label: "입금일 열" },
];

function rowsToMatchUnits(rows: PaymentRow[]): MatchUnit[] {
  return rows.map((row) => ({
    unitId: row.unitId,
    unitNo: row.unitNo,
    payerNo: row.payerNo,
    payerName: row.payerName,
    tenantName: row.tenantName,
    unpaid: row.unpaid,
  }));
}

function money(value: number | null) {
  return formatWon(value, { nullText: "-" });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "은행 엑셀을 처리하지 못했습니다.";
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-t4">-</span>;
  if (delta === 0) {
    return <Badge className="bg-green-t px-2 py-1 text-green">일치</Badge>;
  }
  const isOver = delta > 0;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge
        className={`px-2 py-1 ${
          isOver ? "bg-blue-t text-blue" : "bg-amber-t text-amber"
        }`}
      >
        {isOver ? "초과" : "부분"}
      </Badge>
      <span className="num text-xs font-semibold text-t2">{money(Math.abs(delta))}</span>
    </span>
  );
}

export function BankImportModal({
  open,
  buildingId,
  period,
  rows,
  onClose,
}: BankImportModalProps) {
  const [stage, setStage] = useState<Stage>("select");
  const [headers, setHeaders] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    customerNo: null,
    name: null,
    amount: null,
    paidAt: null,
  });
  const [isParsing, setIsParsing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualAssignments, setManualAssignments] = useState<Record<number, number>>({});
  const [checkedRowIndexes, setCheckedRowIndexes] = useState<Set<number>>(new Set());

  const { data: bankPayments = [] } = useBankPayments(buildingId, period);
  const recordBankPayments = useRecordBankPayments();
  const units = useMemo(() => rowsToMatchUnits(rows), [rows]);
  const deposits = useMemo(() => toDeposits(sheetRows, mapping), [sheetRows, mapping]);
  const automaticResult = useMemo(
    () => matchDeposits(deposits, units),
    [deposits, units],
  );
  const unitById = useMemo(
    () => new Map(units.map((unit) => [unit.unitId, unit])),
    [units],
  );
  const manuallyMatched = useMemo<MatchedDeposit[]>(
    () => automaticResult.unmatched.flatMap((deposit) => {
      const unit = unitById.get(manualAssignments[deposit.rowIndex]);
      if (!unit) return [];
      return [{
        deposit,
        unitId: unit.unitId,
        unitNo: unit.unitNo,
        unpaid: unit.unpaid,
        delta: unit.unpaid == null ? null : deposit.amount - unit.unpaid,
      }];
    }),
    [automaticResult.unmatched, manualAssignments, unitById],
  );
  const unmatched = useMemo(
    () => automaticResult.unmatched.filter(
      (deposit) => manualAssignments[deposit.rowIndex] == null,
    ),
    [automaticResult.unmatched, manualAssignments],
  );
  const matched = useMemo<MatchedPreview[]>(
    () => [...automaticResult.matched, ...manuallyMatched].map((item) => ({
      ...item,
      isDuplicate: bankPayments.some(
        (payment) => payment.unitId === item.unitId
          && payment.amount === item.deposit.amount
          && payment.paidAt === item.deposit.paidAt,
      ),
    })),
    [automaticResult.matched, bankPayments, manuallyMatched],
  );
  const duplicateCount = matched.filter((item) => item.isDuplicate).length;
  const selectedCount = matched.filter(
    (item) => checkedRowIndexes.has(item.deposit.rowIndex),
  ).length;

  if (!open) return null;

  const parseFile = async (file: File) => {
    setIsParsing(true);
    try {
      const parsed = await parseBankWorkbook(await file.arrayBuffer());
      setHeaders(parsed.headers);
      setSheetRows(parsed.rows);
      setMapping(guessColumns(parsed.headers));
      setManualAssignments({});
      setCheckedRowIndexes(new Set());
      setStage("map");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsParsing(false);
    }
  };

  const updateMapping = (key: MappingKey, rawValue: string) => {
    setMapping((current) => ({
      ...current,
      [key]: rawValue === "" ? null : Number(rawValue),
    }));
    setManualAssignments({});
    setCheckedRowIndexes(new Set());
  };

  const openPreview = () => {
    setCheckedRowIndexes(new Set(
      matched
        .filter((item) => !item.isDuplicate)
        .map((item) => item.deposit.rowIndex),
    ));
    setStage("preview");
  };

  const assignUnit = (deposit: Deposit, unitId: number) => {
    const isDuplicate = bankPayments.some(
      (payment) => payment.unitId === unitId
        && payment.amount === deposit.amount
        && payment.paidAt === deposit.paidAt,
    );
    setManualAssignments((current) => ({ ...current, [deposit.rowIndex]: unitId }));
    if (!isDuplicate) {
      setCheckedRowIndexes((current) => new Set(current).add(deposit.rowIndex));
    }
  };

  const toggleChecked = (rowIndex: number, checked: boolean) => {
    setCheckedRowIndexes((current) => {
      const next = new Set(current);
      if (checked) next.add(rowIndex);
      else next.delete(rowIndex);
      return next;
    });
  };

  const confirmPayments = async () => {
    const selected = matched.filter((item) => checkedRowIndexes.has(item.deposit.rowIndex));
    if (selected.length === 0 || recordBankPayments.isPending) return;
    try {
      await recordBankPayments.mutateAsync({
        buildingId,
        period,
        entries: selected.map((item) => ({
          unitId: item.unitId,
          amount: item.deposit.amount,
          paidAt: item.deposit.paidAt,
          memo: item.deposit.name,
        })),
      });
      toast.success(`${selected.length}건 수납 처리`);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const headerOptions = [
    { value: "", label: "선택 안 함" },
    ...headers.map((header, index) => ({ value: String(index), label: header || `${index + 1}열` })),
  ];
  const unitOptions = [
    { value: "", label: "세대 선택" },
    ...units.map((unit) => ({
      value: String(unit.unitId),
      label: `${unit.unitNo}${unit.tenantName ? ` · ${unit.tenantName}` : ""}`,
    })),
  ];

  return (
    <ComplaintDialog
      open
      onClose={onClose}
      title="은행 입금내역 업로드"
      subtitle="은행에서 내려받은 입금내역 엑셀을 첨부해 주세요"
      size="wide"
    >
      <div className="space-y-5">
        {/* Figma 업로드 화면은 드롭존만 노출 — 단계 표시는 매핑/미리보기부터. */}
        {stage !== "select" && (
          <ol className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
            {[
              ["select", "1. 파일 선택"],
              ["map", "2. 열 매핑"],
              ["preview", "3. 미리보기"],
            ].map(([value, label]) => (
              <li
                key={value}
                className={`rounded-lg px-2 py-2 ${
                  stage === value ? "bg-blue-t text-blue" : "bg-bg text-t3"
                }`}
              >
                {label}
              </li>
            ))}
          </ol>
        )}

        {stage === "select" && (
          <div className="space-y-5">
            <FileDropzone
              accept=".xlsx,.xls,.csv"
              helperText="xlsx · xls · csv 파일을 첨부할 수 있어요"
              fileName={selectedFile?.name}
              disabled={isParsing}
              onFile={setSelectedFile}
              ariaLabel="은행 입금내역 엑셀 첨부"
            />
            {isParsing && <p className="text-center text-sm font-semibold text-t2">파일 분석 중…</p>}
            <div className="flex justify-end border-t border-line pt-4">
              <Button
                type="button"
                disabled={!selectedFile || isParsing}
                onClick={() => selectedFile && void parseFile(selectedFile)}
              >
                {isParsing ? "처리 중…" : "처리"}
              </Button>
            </div>
          </div>
        )}

        {stage === "map" && (
          <>
            <section>
              <h3 className="text-base font-extrabold text-t1">엑셀 열 매핑</h3>
              <p className="mt-1 text-sm text-t3">
                자동 추측한 열을 확인해 주세요. 현재 {deposits.length}개 입금 행을 읽었습니다.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {MAPPING_FIELDS.map((field) => (
                  <label key={field.key} className="space-y-2 text-sm font-bold text-t2">
                    {field.label}
                    <Select
                      aria-label={field.label}
                      value={mapping[field.key]?.toString() ?? ""}
                      options={headerOptions}
                      onChange={(event) => updateMapping(field.key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </section>
            <div className="flex justify-between border-t border-line pt-4">
              <Button type="button" variant="ghost" onClick={() => setStage("select")}>
                파일 다시 선택
              </Button>
              <Button type="button" disabled={mapping.amount == null} onClick={openPreview}>
                미리보기
              </Button>
            </div>
          </>
        )}

        {stage === "preview" && (
          <>
            <section className="grid gap-3 sm:grid-cols-3" aria-label="입금 매칭 요약">
              <div className="rounded-xl bg-green-t px-4 py-3">
                <p className="text-xs font-bold text-green">매칭</p>
                <p className="mt-1 text-xl font-extrabold text-t1">{matched.length}건</p>
              </div>
              <div className="rounded-xl bg-amber-t px-4 py-3">
                <p className="text-xs font-bold text-amber">미매칭</p>
                <p className="mt-1 text-xl font-extrabold text-t1">{unmatched.length}건</p>
              </div>
              <div className="rounded-xl bg-blue-t px-4 py-3">
                <p className="text-xs font-bold text-blue">중복</p>
                <p className="mt-1 text-xl font-extrabold text-t1">{duplicateCount}건</p>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-extrabold text-t1">매칭 입금</h3>
                <p className="text-xs font-semibold text-t3">확정 선택 {selectedCount}건</p>
              </div>
              {matched.length === 0 ? (
                <EmptyState message="매칭된 입금이 없습니다" />
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border border-line">
                  <table className="min-w-[780px] w-full text-sm">
                    <thead className="bg-bg text-left text-xs font-bold text-t3">
                      <tr>
                        <th className="px-3 py-3">선택</th>
                        <th className="px-3 py-3">호실</th>
                        <th className="px-3 py-3">입금자</th>
                        <th className="px-3 py-3 text-right">입금액</th>
                        <th className="px-3 py-3 text-right">미납</th>
                        <th className="px-3 py-3">차액</th>
                        <th className="px-3 py-3">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matched.map((item) => (
                        <tr key={item.deposit.rowIndex} className="border-t border-line2">
                          <td className="px-3 py-3">
                            <Checkbox
                              aria-label={`${item.unitNo} 입금 선택`}
                              label=""
                              checked={checkedRowIndexes.has(item.deposit.rowIndex)}
                              onChange={(event) => toggleChecked(item.deposit.rowIndex, event.target.checked)}
                            />
                          </td>
                          <td className="px-3 py-3 font-bold text-t1">{item.unitNo}</td>
                          <td className="px-3 py-3 text-t2">{item.deposit.name || "-"}</td>
                          <td className="num px-3 py-3 text-right font-semibold text-t1">{money(item.deposit.amount)}</td>
                          <td className="num px-3 py-3 text-right text-t2">{money(item.unpaid)}</td>
                          <td className="px-3 py-3"><DeltaBadge delta={item.delta} /></td>
                          <td className="px-3 py-3">
                            {item.isDuplicate ? (
                              <Badge className="bg-amber-t px-2 py-1 text-amber">중복</Badge>
                            ) : (
                              <span className="text-t4">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h3 className="text-base font-extrabold text-t1">미매칭 입금</h3>
              {unmatched.length === 0 ? (
                <EmptyState message="미매칭 입금이 없습니다" />
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border border-line">
                  <table className="min-w-[680px] w-full text-sm">
                    <thead className="bg-bg text-left text-xs font-bold text-t3">
                      <tr>
                        <th className="px-3 py-3">입금자</th>
                        <th className="px-3 py-3 text-right">금액</th>
                        <th className="px-3 py-3">입금일</th>
                        <th className="px-3 py-3">세대 수동 지정</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unmatched.map((deposit) => (
                        <tr key={deposit.rowIndex} className="border-t border-line2">
                          <td className="px-3 py-3 text-t1">{deposit.name || "-"}</td>
                          <td className="num px-3 py-3 text-right font-semibold text-t1">{money(deposit.amount)}</td>
                          <td className="px-3 py-3 text-t2">{deposit.paidAt || "-"}</td>
                          <td className="w-60 px-3 py-3">
                            <Select
                              aria-label={`${deposit.name || deposit.rowIndex + 1} 세대 수동 지정`}
                              value=""
                              options={unitOptions}
                              onChange={(event) => {
                                if (event.target.value) assignUnit(deposit, Number(event.target.value));
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="flex justify-between border-t border-line pt-4">
              <Button type="button" variant="ghost" onClick={() => setStage("map")}>
                열 매핑으로
              </Button>
              <Button
                type="button"
                disabled={selectedCount === 0 || recordBankPayments.isPending}
                onClick={() => void confirmPayments()}
              >
                {recordBankPayments.isPending ? "확정 중…" : "일괄 확정"}
              </Button>
            </div>
          </>
        )}
      </div>
    </ComplaintDialog>
  );
}
