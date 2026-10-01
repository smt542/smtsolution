"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  useCreatePartnerComplaint,
  usePartnerUnits,
  type PartnerUnitOption,
} from "@/hooks/reactquery/complaints";
import { applyMask, Input, NUMERIC_INPUT_ATTRS, Textarea } from "@/components/common";

import { PartnerBottomActionBar } from "../../../_components/PartnerBottomActionBar";
import { PartnerConfirmDialog } from "../../../_components/PartnerConfirmDialog";
import { PartnerDateSheet } from "../../../_components/PartnerDateSheet";
import { PartnerDropdown } from "../../../_components/PartnerDropdown";
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
const STATUS_OPTIONS = AS_STATUS.map((s) => ({ value: s.db, label: s.ko }));

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
            <PartnerDropdown
              ariaLabel="건물"
              value={buildingId}
              options={buildings.map((b) => ({ value: String(b.id), label: b.name }))}
              onChange={(value) => {
                // 정본: 건물을 고르면 호수 목록을 다시 만들고 '건물 전체'로 돌린다.
                setBuildingId(value);
                setUnitId("");
              }}
              placeholder="담당 건물 없음"
            />
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="호수">
            <PartnerDropdown
              ariaLabel="호수"
              value={unitId}
              options={[{ value: "", label: "건물 전체" }, ...units.map((u) => ({ value: String(u.unit_id), label: unitLabel(u) }))]}
              onChange={setUnitId}
            />
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
            <PartnerDropdown
              ariaLabel="유형"
              value={categoryId}
              options={cats.map((c) => ({ value: String(c.id), label: c.label }))}
              onChange={setCategoryId}
              placeholder="유형 선택"
            />
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="입주자 전화번호">
            <span className={`${styles.ro} tabular-nums`}>{reporterPhone || "-"}</span>
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="접수 내용" column>
            <Textarea unstyled ref={contentRef} className={styles.textarea} value={content} onChange={(e) => setContent(e.target.value)} placeholder="접수 내용을 입력해 주세요" />
          </PartnerFormFieldRow>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>처리</div>
          <PartnerFormFieldRow label="처리결과">
            <PartnerDropdown ariaLabel="처리결과" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="시행일자">
            <PartnerDateSheet value={date} onChange={setDate} ariaLabel="시행일자" />
          </PartnerFormFieldRow>
          <PartnerFormFieldRow label="시간">
            <Input
              unstyled
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
            <Textarea unstyled className={styles.textarea} value={result} onChange={(e) => setResult(e.target.value)} placeholder="처리한 내용을 입력해 주세요" />
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
          cancelLabel="취소"
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
