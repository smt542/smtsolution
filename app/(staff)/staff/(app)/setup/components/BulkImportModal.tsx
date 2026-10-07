"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/common";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  MigrationRequestError,
  useImportMigrationRows,
  type MigrationFailure,
  type MigrationKind,
  type MigrationRowInput,
} from "@/hooks/reactquery/dataMigration";
import type { EntitySchema } from "./dataMigration/schemas";
import { parseCSV, validate, buildErrorRows, type ValidateResult } from "./dataMigration/csv";
import { downloadErrorXlsx, downloadTemplateXlsx, parseXlsx } from "./dataMigration/xlsx";

const PREVIEW_COLS = 7;
const PREVIEW_ROWS = 200;
/** 오류 모달에 바로 보여 줄 실패 행 수(나머지는 오류 내역 다운로드로 확인). */
const FAILURE_PREVIEW = 30;

type ErrorDialog =
  | { type: "rows"; failures: MigrationFailure[] }
  | { type: "request"; message: string; okSoFar: number; unsent: MigrationRowInput[] };

export function BulkImportModal({
  open, kind, schema, onClose,
}: {
  open: boolean;
  kind: MigrationKind | null;
  schema: EntitySchema | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [warn, setWarn] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [imported, setImported] = useState({ ok: 0, ng: 0 });
  // 서버 등록 단계에서 거부된 행(행 번호 → 사유). 오류 내역 다운로드에 사전검증 오류와 함께 담는다.
  const [serverErrors, setServerErrors] = useState<Map<number, string>>(new Map());
  const [errorDialog, setErrorDialog] = useState<ErrorDialog | null>(null);
  const importRows = useImportMigrationRows();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep.call(undefined, 1);
    setFileName.call(undefined, "");
    setResult.call(undefined, null);
    setWarn.call(undefined, "");
    setImported.call(undefined, { ok: 0, ng: 0 });
    setServerErrors.call(undefined, new Map());
    setErrorDialog.call(undefined, null);
  }, [open, schema]);

  if (!schema) return null;

  const ok = result ? result.rows.filter((r) => !r.errs.length).length : 0;
  const ng = result ? result.rows.length - ok : 0;
  const canRegister = ok > 0 && (result?.missing.length ?? 0) === 0;

  const applyRows = (rows: string[][], name: string) => {
    if (rows.length < 2) { setWarn("데이터 행이 없어요. 양식에 맞춰 작성했는지 확인해 주세요."); return; }
    setResult(validate(schema, rows));
    setFileName(name);
    setStep(2);
  };

  const readFile = (file: File) => {
    if (/\.xls$/i.test(file.name)) { setWarn('예전 엑셀(.xls) 파일은 읽을 수 없어요. 내려받은 양식(.xlsx)에 작성하거나 CSV UTF-8로 저장해 올려 주세요.'); return; }
    setWarn("");
    if (/\.xlsx$/i.test(file.name)) {
      file.arrayBuffer()
        .then(parseXlsx)
        .then((rows) => applyRows(rows, file.name))
        .catch(() => setWarn("엑셀 파일을 읽지 못했어요. 내려받은 양식에 작성했는지 확인해 주세요."));
      return;
    }
    const fr = new FileReader();
    fr.onload = () => applyRows(parseCSV(String(fr.result)), file.name);
    fr.readAsText(file, "utf-8");
  };

  const downloadErrors = () => {
    if (!result) return;
    void downloadErrorXlsx(schema, buildErrorRows(schema, result, serverErrors).slice(1));
  };

  // 서버 등록. okBefore: 이전 시도(요청 실패 전)까지 이미 등록된 건수 — 재시도 결과에 더한다.
  const submit = async (rows: MigrationRowInput[], okBefore: number) => {
    if (!kind || rows.length === 0 || importRows.isPending) return;
    try {
      const res = await importRows.mutateAsync({ kind, rows });
      const failed = new Map(serverErrors);
      res.failures.forEach((f) => { if (f.line != null) failed.set(f.line, f.message); });
      setServerErrors(failed);
      setImported({ ok: okBefore + res.ok, ng: ng + failed.size });
      setStep(3);
      if (res.failed > 0) setErrorDialog({ type: "rows", failures: res.failures });
    } catch (error) {
      const partial = error instanceof MigrationRequestError ? error.partial : null;
      const unsentCount = error instanceof MigrationRequestError ? error.unsentCount : rows.length;
      if (partial) {
        const failed = new Map(serverErrors);
        partial.failures.forEach((f) => { if (f.line != null) failed.set(f.line, f.message); });
        setServerErrors(failed);
      }
      setErrorDialog({
        type: "request",
        message: error instanceof Error ? error.message : String(error),
        okSoFar: okBefore + (partial?.ok ?? 0),
        unsent: rows.slice(rows.length - unsentCount),
      });
    }
  };

  const register = () => {
    if (!canRegister || !result) return;
    void submit(
      result.rows.filter((r) => !r.errs.length).map((r) => ({ line: r.line, rec: r.rec })),
      0,
    );
  };

  const cols = schema.cols.slice(0, PREVIEW_COLS);

  return (
    <Modal open={open} onClose={onClose} title={`${schema.label} 엑셀 일괄등록`} className="max-w-3xl">
      <div className="max-h-[70vh] overflow-auto">
        {step === 1 && (
          <div className="flex flex-col gap-3">
            {schema.note && <p className="text-sm text-t3">{schema.note}</p>}
            <div className="rounded-xl bg-bg p-4 text-sm">
              <div className="font-extrabold text-t1">1. 양식 내려받기</div>
              <p className="mt-1 text-t3">서비스에 필요한 항목과 입력 예시가 들어 있는 양식이에요. 첫 행(열 이름)은 수정하지 마세요.</p>
              <div className="mt-3 font-extrabold text-t1">2. 양식에 데이터 채우기</div>
              <p className="mt-1 text-t3">내려받은 엑셀 양식에 그대로 작성해 저장해 주세요. 구분처럼 정해진 값만 들어가는 칸은 <b className="text-t2">목록에서 골라</b> 입력해요. CSV(UTF-8)도 올릴 수 있어요.</p>
              <div className="mt-3 font-extrabold text-t1">3. 파일 올리기</div>
              <p className="mt-1 text-t3">업로드하면 등록 전에 오류를 먼저 확인할 수 있어요. 중복 기준은 <b className="text-t2">{schema.keyLabel}</b>이고, 열은 <b className="text-t2">{schema.cols.length}</b>개예요.</p>
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
              className={`flex flex-col items-center gap-2 rounded-xl border border-dashed px-5 py-7 text-center transition-colors ${dragOver ? "border-brand bg-brand/5" : "border-line hover:border-brand hover:bg-brand/5"}`}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-brand"><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></svg>
              <b className="text-sm text-t1">엑셀(.xlsx) 또는 CSV 파일을 끌어다 놓거나 클릭해서 선택</b>
              <span className="text-xs text-t3">양식에 맞춰 작성한 파일만 인식해요</span>
            </button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />
            {warn && <div className="rounded-xl border border-danger/25 bg-danger/5 px-3 py-2.5 text-xs font-bold text-danger">{warn}</div>}
          </div>
        )}

        {step === 2 && result && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-2 text-sm text-t3">
              <span className="font-bold text-t1">{fileName}</span>
              <span>{schema.label} · 전체 <b className="text-t1 tabular-nums">{result.rows.length}</b>행 · 정상 <b className="text-brand tabular-nums">{ok}</b> · 오류 <b className="text-danger tabular-nums">{ng}</b></span>
            </div>
            {result.missing.length > 0 && (
              <div className="rounded-xl border border-danger/25 bg-danger/5 px-3 py-2.5 text-xs font-bold text-danger">필수 열이 없습니다: {result.missing.join(", ")}</div>
            )}
            <div className="max-h-[46vh] overflow-auto rounded-xl border border-line">
              <table className="w-full border-collapse whitespace-nowrap text-xs">
                <thead>
                  <tr>
                    <th className="sticky top-0 border-b border-line bg-bg px-3 py-2 text-left font-bold text-t3">행</th>
                    {cols.map((c) => <th key={c.k} className="sticky top-0 border-b border-line bg-bg px-3 py-2 text-left font-bold text-t3">{c.k}</th>)}
                    <th className="sticky top-0 border-b border-line bg-bg px-3 py-2 text-left font-bold text-t3">검증</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, PREVIEW_ROWS).map((r) => (
                    <tr key={r.line} className={r.errs.length ? "bg-danger/5" : ""}>
                      <td className="border-b border-line2 px-3 py-2 text-t4 tabular-nums">{r.line}</td>
                      {cols.map((c) => (
                        <td key={c.k} className={`border-b border-line2 px-3 py-2 font-semibold ${r.bad[c.k] ? "text-danger" : "text-t2"}`}>{r.rec[c.k] || "-"}</td>
                      ))}
                      <td className="border-b border-line2 px-3 py-2 whitespace-normal">
                        {r.errs.length ? <span className="font-bold text-danger">{r.errs.join(", ")}</span> : <span className="font-bold text-brand">정상</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(result.rows.length > PREVIEW_ROWS || schema.cols.length > PREVIEW_COLS) && (
              <div className="text-xs text-t4">앞 {Math.min(PREVIEW_ROWS, result.rows.length)}행 · 앞 {PREVIEW_COLS}개 열만 미리 봅니다 (전체 {result.rows.length}행 · {schema.cols.length}열)</div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="px-2 py-8 text-center">
            <div className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-brand text-2xl font-extrabold text-white">✓</div>
            <div className="text-lg font-extrabold text-t1">{imported.ok ? `${schema.label} ${imported.ok}건을 등록했어요` : `${schema.label} 등록에 실패했어요`}</div>
            <div className="mt-2 text-sm text-t3">
              {imported.ng
                ? <>오류 <b className="text-danger">{imported.ng}</b>건은 등록하지 않았어요. 오류 내역을 내려받아 수정 후 다시 올려 주세요.</>
                : "모든 행이 정상 등록되었습니다."}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-line2 pt-4">
        {step === 1 && (
          <>
            <button type="button" onClick={() => void downloadTemplateXlsx(schema)} className="h-10 rounded-[11px] border border-line bg-white px-4 text-[13.5px] font-bold text-t2 hover:bg-bg">양식 다운로드</button>
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="h-10 rounded-[11px] border border-line bg-white px-4 text-[13.5px] font-bold text-t2 hover:bg-bg">닫기</button>
          </>
        )}
        {step === 2 && (
          <>
            <button type="button" onClick={() => { setStep(1); setResult(null); }} className="h-10 rounded-[11px] border border-line bg-white px-4 text-[13.5px] font-bold text-t2 hover:bg-bg">다시 선택</button>
            <div className="flex-1" />
            <button type="button" onClick={register} disabled={!canRegister || importRows.isPending} className="h-10 rounded-[11px] bg-brand px-4 text-[13.5px] font-bold text-white shadow-pri hover:bg-brand-dark disabled:cursor-default disabled:opacity-40">{importRows.isPending ? "등록 중…" : ok ? `${ok}건 등록` : "등록할 행이 없어요"}</button>
          </>
        )}
        {step === 3 && (
          <>
            {imported.ng > 0 && result && (
              <button type="button" onClick={downloadErrors} className="h-10 rounded-[11px] border border-line bg-white px-4 text-[13.5px] font-bold text-t2 hover:bg-bg">오류 내역 다운로드</button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="h-10 rounded-[11px] bg-brand px-4 text-[13.5px] font-bold text-white shadow-pri hover:bg-brand-dark">완료</button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={errorDialog?.type === "rows"}
        look="plain"
        variant="danger"
        title={`${errorDialog?.type === "rows" ? errorDialog.failures.length : 0}건은 등록하지 못했어요`}
        description="아래 행은 서버에서 거부되어 저장되지 않았어요. 나머지 행은 정상 등록되었습니다. 오류 내역을 내려받아 수정한 뒤 해당 행만 다시 올려 주세요."
        confirmLabel="오류 내역 다운로드"
        cancelLabel="닫기"
        widthClassName="w-[min(520px,92%)]"
        onConfirm={() => {
          downloadErrors();
          setErrorDialog(null);
        }}
        onCancel={() => setErrorDialog(null)}
      >
        {errorDialog?.type === "rows" && (
          <ul className="mt-3 max-h-[40vh] overflow-auto rounded-xl border border-line text-xs">
            {errorDialog.failures.slice(0, FAILURE_PREVIEW).map((f, i) => (
              <li key={`${f.line ?? "?"}-${i}`} className="flex gap-3 border-b border-line2 px-3 py-2 last:border-b-0">
                <span className="w-[44px] flex-none font-bold tabular-nums text-t4">{f.line != null ? `${f.line}행` : "-"}</span>
                <span className="font-bold text-danger">{f.message}</span>
              </li>
            ))}
            {errorDialog.failures.length > FAILURE_PREVIEW && (
              <li className="px-3 py-2 text-t4">외 {errorDialog.failures.length - FAILURE_PREVIEW}건은 오류 내역에서 확인해 주세요.</li>
            )}
          </ul>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={errorDialog?.type === "request"}
        look="plain"
        variant="danger"
        title="등록 중 문제가 생겼어요"
        description={
          errorDialog?.type === "request"
            ? `서버에 저장하는 중 오류가 발생했어요.${errorDialog.okSoFar ? ` 이미 ${errorDialog.okSoFar}건은 등록되었고,` : ""} 남은 ${errorDialog.unsent.length}건은 등록되지 않았어요.\n\n오류: ${errorDialog.message}`
            : undefined
        }
        confirmLabel={importRows.isPending ? "다시 시도 중…" : "다시 시도"}
        cancelLabel="닫기"
        confirmDisabled={importRows.isPending}
        onConfirm={() => {
          if (errorDialog?.type !== "request") return;
          const { unsent, okSoFar } = errorDialog;
          setErrorDialog(null);
          void submit(unsent, okSoFar);
        }}
        onCancel={() => {
          if (errorDialog?.type === "request" && errorDialog.okSoFar > 0) {
            // 일부는 이미 저장됐으므로 결과 화면으로 넘겨 등록·미등록 건수를 보여 준다.
            setImported({ ok: errorDialog.okSoFar, ng: ng + serverErrors.size + errorDialog.unsent.length });
            setStep(3);
          }
          setErrorDialog(null);
        }}
      />
    </Modal>
  );
}
