"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  useCreatePartnerComplaint,
  usePartnerUnits,
  type PartnerUnitOption,
} from "@/hooks/reactquery/complaints";
import { applyMask, NUMERIC_INPUT_ATTRS } from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { CalendarIcon } from "@/components/icons";

import { PartnerBottomActionBar } from "../../../_components/PartnerBottomActionBar";
import { PartnerConfirmDialog } from "../../../_components/PartnerConfirmDialog";
import { PartnerFormFieldRow } from "../../../_components/PartnerFormFieldRow";
import { PartnerMobileHeader } from "../../../_components/PartnerMobileHeader";
import { PartnerToast, usePartnerToast } from "../../../_components/PartnerToast";
import { AS_STATUS, combineDateTime, normalizeTime, timeMask } from "../_as";
import { asFormClasses as styles } from "../asFormClasses";
import { PartnerButton } from "../../../_components/PartnerButton";

export type Building = { id: number; name: string };
export type Cat = { id: number; label: string };

/** 정본은 등록 토스트를 보여 준 뒤 0.7초 있다가 홈으로 간다. */
const LEAVE_DELAY_MS = 700;

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
  const { toastMessage, showToast } = usePartnerToast();
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [buildingId, setBuildingId] = useState(() => buildings[0] ? String(buildings[0].id) : "");
  const [unitId, setUnitId] = useState("");
  // 정본: 유형은 첫 항목(A/S신청)이 기본이고 '선택 안 함'은 없다.
  const [categoryId, setCategoryId] = useState(() => cats[0] ? String(cats[0].id) : "");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("pending");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [result, setResult] = useState("");

  const [confirmReg, setConfirmReg] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // 등록 뒤 홈으로 가기 전 0.7초 동안 버튼을 다시 누르지 못하게 한다.
  const [leaving, setLeaving] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unitsQuery = usePartnerUnits(buildingId ? Number(buildingId) : null);
  const createMutation = useCreatePartnerComplaint();
  const units = unitsQuery.data ?? [];
  const isRegisteringComplaint = createMutation.isPending || leaving;

  const selectedUnit = units.find((u) => String(u.unit_id) === unitId);
  const reporterPhone = selectedUnit?.phone ?? "";

  useEffect(() => () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
  }, []);

  // 정본 `#anSave`: 입력을 먼저 확인하고, 통과하면 등록 확인창을 연다.
  const requestRegister = () => {
    if (isRegisteringComplaint) return;
    if (!buildingId) {
      showToast("건물을 선택해 주세요");
      return;
    }
    if (!content.trim()) {
      showToast("접수 내용을 입력해 주세요");
      contentRef.current?.focus();
      return;
    }
    setConfirmReg(true);
  };

  const register = async () => {
    if (isRegisteringComplaint) return;
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
      setLeaving(true);
      showToast("접수를 등록했어요");
      leaveTimerRef.current = setTimeout(() => router.push("/partner/mobile-home"), LEAVE_DELAY_MS);
    } catch {
      showToast("접수 등록에 실패했어요. 다시 시도해 주세요.");
    }
  };

  const header = <PartnerMobileHeader title="신규 접수" onBack={() => setConfirmCancel(true)} variant="compact" />;

  return (
    <div className={styles.root}>
      {header}
      <div className={styles.scroll}>
        <div className={styles.sec}>
          <div className={styles.secTitle}>대상 세대</div>
          <PartnerFormFieldRow label="건물">
            <select
              className={styles.control}
              value={buildingId}
              aria-label="건물"
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
            <select className={styles.control} value={unitId} onChange={(e) => setUnitId(e.target.value)} aria-label="호수">
              <option value="">건물 전체</option>
              {units.map((u) => (
                <option key={u.unit_id} value={String(u.unit_id)}>{unitLabel(u)}</option>
              ))}
            </select>
          </PartnerFormFieldRow>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>접수 정보</div>
          <PartnerFormFieldRow label="접수자">
            <span className={styles.ro}>{myName || "-"}</span>
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="담당자">
            <span className={styles.ro}>{myName || "-"}</span>
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="접수일시">
            <span className={`${styles.ro} tabular-nums`}>{today}</span>
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="유형">
            <select className={styles.control} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="유형">
              {cats.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.label}</option>
              ))}
            </select>
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="입주자 전화번호">
            <span className={`${styles.ro} tabular-nums`}>{reporterPhone || "-"}</span>
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="접수 내용" column>
            <textarea ref={contentRef} className={styles.textarea} value={content} onChange={(e) => setContent(e.target.value)} placeholder="접수 내용을 입력해 주세요" />
          </PartnerFormFieldRow>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>처리</div>
          <PartnerFormFieldRow label="처리결과">
            <select className={styles.control} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="처리결과">
              {AS_STATUS.map((s) => (
                <option key={s.db} value={s.db}>{s.ko}</option>
              ))}
            </select>
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="시행일자">
            <DpDatePicker
              value={date}
              onChange={setDate}
              ariaLabel="시행일자"
              placeholder="날짜 선택"
              className={styles.pickerRoot}
              triggerClassName={styles.picker}
              triggerOpenClassName={styles.pickerOpen}
              endAdornment={<CalendarIcon className="ml-auto size-4 shrink-0 text-t3" aria-hidden="true" />}
            />
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="시간">
            <input
              className={styles.time}
              {...NUMERIC_INPUT_ATTRS}
              placeholder="00:00"
              maxLength={5}
              aria-label="시간"
              value={time}
              onChange={(e) => setTime(applyMask(e.currentTarget, timeMask))}
              onBlur={() => setTime(normalizeTime(time))}
            />
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="처리결과 내용" column>
            <textarea className={styles.textarea} value={result} onChange={(e) => setResult(e.target.value)} placeholder="처리한 내용을 입력해 주세요" />
          </PartnerFormFieldRow>
        </div>
      </div>

      <PartnerBottomActionBar>
        <PartnerButton variant="secondary" type="button" className="flex-1" onClick={() => setConfirmCancel(true)} disabled={isRegisteringComplaint}>취소</PartnerButton>
        <PartnerButton variant="primary" type="button" className="flex-1" onClick={requestRegister} disabled={isRegisteringComplaint}>접수 등록</PartnerButton>
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

      <PartnerToast message={toastMessage} />
    </div>
  );
}
