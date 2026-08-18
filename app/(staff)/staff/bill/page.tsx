"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Select, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { hasModule } from "@/lib/auth/permissions";
import { useBuildings, type Building } from "@/hooks/reactquery/buildings";
import { useSetupConfig, type SetupConfig } from "@/hooks/reactquery/setupConfig";
import {
  useBillDocuments,
  useBillOrganizationName,
  useBillTargets,
  useIssueBills,
  useRecordBillDelivery,
} from "@/hooks/reactquery/bill";
import { useCancelScheduledMessage } from "@/hooks/reactquery/messaging";
import { currentPeriod, fromMonthInput, toMonthInput } from "@/lib/billing/period";
import { printableAccounts, PROGRAM_COMPANY_NAME } from "@/lib/bill/document";
import type { MessageRecipient } from "@/lib/messaging/preset";
import { MessagingModal } from "@/app/(staff)/staff/messaging/components/MessagingModal";
import { BillTargetTable } from "./components/BillTargetTable";
import { BillPrintView } from "./components/BillPrintView";
import { DocumentCards, type OutputDocumentType } from "./components/DocumentCards";
import { DocumentOutputModal } from "./components/DocumentOutputModal";

interface LegacyA4WorkspaceProps {
  buildings: Building[];
  config: SetupConfig | null | undefined;
  onBack: () => void;
}

function LegacyA4Workspace({ buildings, config, onBack }: LegacyA4WorkspaceProps) {
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [period, setPeriod] = useState(() => currentPeriod());
  const [labelMode, setLabelMode] = useState<"code" | "name">(config?.unitLabelDefault ?? "code");
  const [dueDate, setDueDate] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [sendOpen, setSendOpen] = useState(false);
  const [waterCutoffOverrides, setWaterCutoffOverrides] = useState<Record<number, boolean>>({});

  const { data: targets, isLoading, refetch: refetchTargets } = useBillTargets(buildingId, period);
  const { data: documents } = useBillDocuments(buildingId, period, selected);
  const issue = useIssueBills();
  const recordDelivery = useRecordBillDelivery();
  const cancelSchedule = useCancelScheduledMessage();
  const building = buildings.find((candidate) => candidate.id === buildingId) ?? null;
  const rows = (targets ?? []).map((target) => ({
    ...target,
    waterCutoff: waterCutoffOverrides[target.unitId] ?? target.waterCutoff,
  }));
  const waterCutoffUnitIds = rows.filter((target) => target.waterCutoff).map((target) => target.unitId);

  const toggle = (id: number) => setSelected((current) =>
    current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
  );
  const toggleAll = () => setSelected((current) =>
    current.length === rows.length ? [] : rows.map((row) => row.unitId),
  );

  const print = async () => {
    if (!buildingId || selected.length === 0) return;
    if (!documents || documents.length === 0) {
      toast.error("고지서 데이터를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }
    try {
      await issue.mutateAsync({
        buildingId,
        period,
        unitIds: selected,
        issueType: "a4",
        dueDate: dueDate || null,
        unitLabelMode: labelMode,
        waterCutoffUnitIds: waterCutoffUnitIds.filter((unitId) => selected.includes(unitId)),
      });
      window.print();
      toast.success(`${selected.length}세대 고지서를 발행했습니다`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "발행에 실패했습니다.");
    }
  };

  const recipients: MessageRecipient[] = rows
    .filter((target) => selected.includes(target.unitId))
    .flatMap((target) => [
      {
        name: target.tenantName,
        phone: target.phone,
        phoneType: "primary" as const,
        unitNo: target.unitNo,
        kind: "tenant" as const,
        ref: {
          occupancyId: target.occupancyId ?? undefined,
          unitId: target.unitId,
          buildingId: buildingId ?? undefined,
        },
      },
      ...(target.secondaryPhone ? [{
        name: target.tenantName,
        phone: target.secondaryPhone,
        phoneType: "secondary" as const,
        unitNo: target.unitNo,
        kind: "tenant" as const,
        ref: {
          occupancyId: target.occupancyId ?? undefined,
          unitId: target.unitId,
          buildingId: buildingId ?? undefined,
        },
      }] : []),
    ]);

  const cancelSelectedSchedules = async () => {
    const scheduleIds = [...new Set(rows
      .filter((target) => selected.includes(target.unitId) && target.sendStatus === "scheduled")
      .map((target) => target.messageScheduleId)
      .filter((id): id is number => id !== null))];
    if (scheduleIds.length === 0) return;
    try {
      for (const scheduleId of scheduleIds) await cancelSchedule.mutateAsync(scheduleId);
      await refetchTargets();
      toast.success("예약이 취소되었습니다.");
    } catch {
      toast.error("예약 취소에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  return (
    <>
      <div className="flex flex-col gap-5 p-4 print:hidden sm:p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <button type="button" onClick={onBack} className="text-sm font-bold text-brand hover:underline">← 문서 선택</button>
            <h1 className="mt-2 text-2xl font-extrabold text-t1">A4 관리비 고지서</h1>
            <p className="mt-1 text-sm text-t3">기존 고지서 발행·문자 발송 화면입니다.</p>
          </div>
        </header>

        <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <label className="flex min-w-52 flex-col gap-1 text-sm font-bold text-t2">
            건물
            <Select
              aria-label="건물 선택"
              value={buildingId != null ? String(buildingId) : ""}
              onChange={(event) => {
                setBuildingId(event.target.value ? Number(event.target.value) : null);
                setSelected([]);
                setWaterCutoffOverrides({});
              }}
              options={[
                { value: "", label: "건물을 선택해 주세요" },
                ...buildings.map((item) => ({ value: String(item.id), label: item.name })),
              ]}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-t2">
            부과월
            <input
              type="month"
              aria-label="부과월"
              value={toMonthInput(period)}
              onChange={(event) => {
                setPeriod(fromMonthInput(event.target.value));
                setSelected([]);
                setWaterCutoffOverrides({});
              }}
              className="h-11 rounded-xl border border-line bg-surface px-3 text-sm text-t1"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-t2">
            세대 표기
            <Select
              aria-label="세대 표기"
              value={labelMode}
              onChange={(event) => setLabelMode(event.target.value as "code" | "name")}
              options={[{ value: "code", label: "코드출력" }, { value: "name", label: "이름출력" }]}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-t2">
            납기일
            <input type="date" aria-label="납기일" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-11 rounded-xl border border-line bg-surface px-3 text-sm text-t1" />
          </label>
        </section>

        {!buildingId ? (
          <div className="rounded-xl border border-line bg-surface p-8 text-center text-t2">건물을 선택해 주세요.</div>
        ) : isLoading ? (
          <Spinner />
        ) : (
          <BillTargetTable
            targets={rows}
            unitLabelMode={labelMode}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onWaterCutoffChange={(unitId, checked) => setWaterCutoffOverrides((current) => ({ ...current, [unitId]: checked }))}
            onPrint={() => void print()}
            onSend={() => setSendOpen(true)}
            onCancelSchedule={() => void cancelSelectedSchedules()}
            isCancellingSchedule={cancelSchedule.isPending}
          />
        )}

        <MessagingModal
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          preset={{
            context: "고지서",
            buildingId: buildingId ?? undefined,
            channel: "alimtalk",
            mode: "alimtalk",
            templateTitle: "고지서",
            recipients,
          }}
          onSent={async (result) => {
            if (!buildingId) return;
            const deliveredUnitIds = [...new Set(result.recipients
              .map((recipient) => recipient.ref?.unitId)
              .filter((unitId): unitId is number => unitId !== undefined))];
            try {
              await recordDelivery.mutateAsync({
                buildingId,
                period,
                unitIds: deliveredUnitIds,
                issueType: "kakao",
                sendStatus: result.status,
                messageLogId: result.status === "sent" ? result.logId : null,
                messageScheduleId: result.status === "scheduled" ? result.logId : null,
                scheduledAt: result.scheduledAt,
              });
              setSendOpen(false);
            } catch {
              toast.error("발송 상태를 저장하지 못했습니다.");
            }
          }}
          onFailed={async () => {
            if (!buildingId) return;
            try {
              await recordDelivery.mutateAsync({
                buildingId,
                period,
                unitIds: selected,
                issueType: "kakao",
                sendStatus: "failed",
              });
            } catch {
              // 원 발송 오류 토스트를 유지하고 상태 기록 실패는 별도 전파하지 않는다.
            }
          }}
        />
      </div>

      {building && documents && (
        <BillPrintView
          buildingName={building.name}
          period={period}
          unitLabelMode={labelMode}
          dueDate={dueDate || null}
          accounts={printableAccounts(config)}
          customerNotice={config?.customerNotice ?? null}
          documents={documents}
          waterCutoffUnitIds={waterCutoffUnitIds.filter((unitId) => selected.includes(unitId))}
        />
      )}
    </>
  );
}

export default function BillPage() {
  const { data: me } = useMe();
  const { data: allBuildings = [], isLoading: areBuildingsLoading } = useBuildings();
  const { data: config } = useSetupConfig(me?.orgId);
  const { data: organizationName } = useBillOrganizationName(me?.orgId);
  const [activeDocument, setActiveDocument] = useState<OutputDocumentType | null>(null);
  const [showLegacyA4, setShowLegacyA4] = useState(false);

  if (me === undefined) return <Spinner />;
  if (!me || !hasModule(me, "bill_publish")) {
    return <div className="p-8 text-t2">접근할 권한이 없습니다.</div>;
  }

  const buildings = allBuildings.filter((building) => building.orgId === me.orgId);
  if (showLegacyA4) {
    return <LegacyA4Workspace buildings={buildings} config={config} onBack={() => setShowLegacyA4(false)} />;
  }

  return (
    <>
      <div className="min-h-screen p-4 print:hidden sm:p-6">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-t3">관리업무 · 문서 센터</p>
            <h1 className="mt-1 text-2xl font-extrabold text-t1">서류 발행·출력</h1>
            <p className="mt-2 text-sm text-t2">출력할 문서 유형을 선택한 뒤 연도·월분·건물을 지정해 주세요.</p>
          </div>
          <Button type="button" variant="ghost" onClick={() => setShowLegacyA4(true)}>기존 A4 화면</Button>
        </header>

        {areBuildingsLoading ? <Spinner /> : <DocumentCards onOpen={setActiveDocument} onOpenA4={() => setShowLegacyA4(true)} />}
      </div>

      {activeDocument && (
        <DocumentOutputModal
          key={activeDocument}
          type={activeDocument}
          buildings={buildings}
          companyName={organizationName ?? PROGRAM_COMPANY_NAME}
          accounts={printableAccounts(config)}
          customerNotice={config?.customerNotice ?? null}
          onClose={() => setActiveDocument(null)}
        />
      )}
    </>
  );
}
