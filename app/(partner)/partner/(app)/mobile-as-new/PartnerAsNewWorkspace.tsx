"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  useCreatePartnerComplaint,
  usePartnerUnits,
  type PartnerUnitOption,
} from "@/hooks/reactquery/complaints";

import { PartnerBottomActionBar } from "../../../_components/PartnerBottomActionBar";
import { PartnerConfirmDialog } from "../../../_components/PartnerConfirmDialog";
import { PartnerFormFieldRow } from "../../../_components/PartnerFormFieldRow";
import { PartnerInlineError } from "../../../_components/PartnerInlineError";
import { PartnerMobileHeader } from "../../../_components/PartnerMobileHeader";
import { AS_STATUS, combineDateTime } from "../_as";
import { asFormClasses as styles } from "../asFormClasses";

export type Building = { id: number; name: string };
export type Cat = { id: number; label: string };

function unitLabel(u: PartnerUnitOption) {
  return `${u.dong ? `${u.dong} ` : ""}${u.unit_no}`;
}

export default function PartnerAsNewWorkspace({
  buildings,
  cats,
  myName,
  today,
}: {
  buildings: Building[];
  cats: Cat[];
  myName: string;
  today: string;
}) {
  const router = useRouter();

  const [buildingId, setBuildingId] = useState(() => buildings[0] ? String(buildings[0].id) : "");
  const [unitId, setUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("pending");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [result, setResult] = useState("");

  const [err, setErr] = useState("");
  const [confirmReg, setConfirmReg] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const unitsQuery = usePartnerUnits(buildingId ? Number(buildingId) : null);
  const createMutation = useCreatePartnerComplaint();
  const units = unitsQuery.data ?? [];
  const isRegisteringComplaint = createMutation.isPending;

  const selectedUnit = units.find((u) => String(u.unit_id) === unitId);
  const reporterPhone = selectedUnit?.phone ?? "";

  const register = async () => {
    if (isRegisteringComplaint) return;
    setErr("");
    if (!buildingId) {
      setErr("건물을 선택해 주세요");
      return;
    }
    if (!content.trim()) {
      setErr("접수 내용을 입력해 주세요");
      return;
    }
    try {
      await createMutation.mutateAsync({
        buildingId: Number(buildingId),
        unitId: unitId ? Number(unitId) : null,
        categoryId: categoryId ? Number(categoryId) : null,
        content: content.trim(),
        status,
        completedAt: combineDateTime(date, time),
        resultContent: result.trim(),
        reporterPhone,
      });
      router.push("/partner/mobile-home");
    } catch {
      setErr("접수 등록에 실패했어요. 다시 시도해 주세요.");
    }
  };

  const header = <PartnerMobileHeader title="신규 접수" onBack={() => setConfirmCancel(true)} variant="compact" />;

  return (
    <div className={styles.root}>
      {header}
      <div className={styles.scroll}>
        <div className={styles.sec}>
          <div className={styles.secTitle}>대상 세대</div>
          <div className={styles.box}>
            <PartnerFormFieldRow label="건물">
              <select
                className={styles.control}
                value={buildingId}
                onChange={(e) => {
                  setBuildingId(e.target.value);
                  setUnitId("");
                }}
              >
                {buildings.length === 0 && <option value="">담당 건물 없음</option>}
                {buildings.map((b) => (
                  <option key={b.id} value={String(b.id)}>{b.name}</option>
                ))}
              </select>
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="호수">
              <select className={styles.control} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">건물 전체</option>
                {units.map((u) => (
                  <option key={u.unit_id} value={String(u.unit_id)}>{unitLabel(u)}</option>
                ))}
              </select>
            </PartnerFormFieldRow>
          </div>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>접수 정보</div>
          <div className={styles.box}>
            <PartnerFormFieldRow label="접수자">
              <span className={styles.ro}>{myName || "-"}</span>
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="담당자">
              <span className={styles.ro}>{myName || "-"}</span>
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="접수일시">
              <span className={styles.ro}>{today}</span>
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="유형">
              <select className={styles.control} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">선택 안 함</option>
                {cats.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.label}</option>
                ))}
              </select>
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="입주자 전화번호">
              <span className={styles.ro}>{reporterPhone || "-"}</span>
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="접수 내용" column>
              <textarea className={styles.textarea} value={content} onChange={(e) => setContent(e.target.value)} placeholder="접수 내용을 입력해 주세요" />
            </PartnerFormFieldRow>
          </div>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>처리</div>
          <div className={styles.box}>
            <PartnerFormFieldRow label="처리결과">
              <select className={styles.control} value={status} onChange={(e) => setStatus(e.target.value)}>
                {AS_STATUS.map((s) => (
                  <option key={s.db} value={s.db}>{s.ko}</option>
                ))}
              </select>
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="시행일자">
              <input type="date" className={styles.control} value={date} onChange={(e) => setDate(e.target.value)} />
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="시간">
              <input type="time" className={styles.control} value={time} onChange={(e) => setTime(e.target.value)} />
            </PartnerFormFieldRow>
            <PartnerFormFieldRow label="처리결과 내용" column>
              <textarea className={styles.textarea} value={result} onChange={(e) => setResult(e.target.value)} placeholder="처리한 내용을 입력해 주세요" />
            </PartnerFormFieldRow>
          </div>
        </div>

        {err && <PartnerInlineError message={err} />}
      </div>

      <PartnerBottomActionBar>
        <button type="button" className={`${styles.btn} ${styles.btnSec}`} onClick={() => setConfirmCancel(true)} disabled={isRegisteringComplaint}>취소</button>
        <button type="button" className={`${styles.btn} ${styles.btnPri}`} onClick={() => setConfirmReg(true)} disabled={isRegisteringComplaint}>{isRegisteringComplaint ? "접수 등록 중…" : "접수 등록"}</button>
      </PartnerBottomActionBar>

      {confirmReg && (
        <PartnerConfirmDialog
          title="접수를 등록할까요?"
          description="입력한 내용으로 A/S 접수가 등록돼요."
          cancelLabel="취소"
          confirmLabel="등록"
          onCancel={() => setConfirmReg(false)}
          onConfirm={() => { setConfirmReg(false); void register(); }}
          confirmDisabled={isRegisteringComplaint}
        />
      )}

      {confirmCancel && (
        <PartnerConfirmDialog
          title="작성을 취소할까요?"
          description="입력한 내용은 저장되지 않아요."
          cancelLabel="계속 작성"
          confirmLabel="나가기"
          confirmVariant="danger"
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() => router.push("/partner/mobile-home")}
        />
      )}
    </div>
  );
}
