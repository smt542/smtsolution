"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Select } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { hasModule } from "@/lib/auth/permissions";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import {
  useBillTargets,
  useBillDocuments,
  useIssueBills,
} from "@/hooks/reactquery/bill";
import {
  currentPeriod,
  toMonthInput,
  fromMonthInput,
} from "@/lib/billing/period";
import { printableAccounts } from "@/lib/bill/document";
import type { MessageRecipient } from "@/lib/messaging/preset";
import { MessagingModal } from "@/app/(staff)/staff/messaging/components/MessagingModal";
import { BillTargetTable } from "./components/BillTargetTable";
import { BillPrintView } from "./components/BillPrintView";

export default function BillPage() {
  const { data: me } = useMe();
  const { data: buildings } = useBuildings();
  const { data: config } = useSetupConfig(me?.orgId);

  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [period, setPeriod] = useState(() => currentPeriod());
  const [labelMode, setLabelMode] = useState<"code" | "name">("code");
  const [dueDate, setDueDate] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [sendOpen, setSendOpen] = useState(false);

  // setup 기본 세대표기 반영(렌더-중 이전값 비교 — set-state-in-effect 회피)
  const [prevDefault, setPrevDefault] = useState<string | undefined>(undefined);
  if (config && config.unitLabelDefault !== prevDefault) {
    setPrevDefault(config.unitLabelDefault as string);
    setLabelMode(config.unitLabelDefault as "code" | "name");
  }

  const { data: targets, isLoading } = useBillTargets(buildingId, period);
  const { data: documents } = useBillDocuments(buildingId, period, selected);
  const issue = useIssueBills();

  if (!hasModule(me, "bill_publish")) {
    return <div className="p-8 text-t2">접근할 권한이 없습니다.</div>;
  }

  const building =
    (buildings ?? []).find((b) => b.id === buildingId) ?? null;
  const rows = targets ?? [];

  const toggle = (id: number) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  const toggleAll = () =>
    setSelected((s) =>
      s.length === rows.length ? [] : rows.map((r) => r.unitId),
    );

  const onPrint = async () => {
    if (!buildingId || selected.length === 0) return;
    if (!documents || documents.length === 0) {
      toast.error(
        "고지서 데이터를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.",
      );
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
      });
      window.print();
      toast.success(`${selected.length}세대 고지서를 발행했습니다`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "발행에 실패했습니다.");
    }
  };

  const recipients: MessageRecipient[] = rows
    .filter((t) => selected.includes(t.unitId))
    .map((t) => ({
      name: t.tenantName,
      phone: t.phone,
      unitNo: t.unitNo,
      kind: "tenant" as const,
      ref: {
        occupancyId: t.occupancyId ?? undefined,
        buildingId: buildingId ?? undefined,
      },
    }));

  return (
    <>
    <div className="flex flex-col gap-4 p-6 print:hidden">
      <h1 className="text-lg font-extrabold text-t1">고지서 발행</h1>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-t2">
          건물
          <Select
            aria-label="건물 선택"
            value={buildingId != null ? String(buildingId) : ""}
            onChange={(e) => {
              setBuildingId(e.target.value ? Number(e.target.value) : null);
              setSelected([]);
            }}
            options={[
              { value: "", label: "건물을 선택해 주세요" },
              ...(buildings ?? []).map((b) => ({
                value: String(b.id),
                label: b.name,
              })),
            ]}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-t2">
          부과월
          <input
            type="month"
            aria-label="부과월"
            value={toMonthInput(period)}
            onChange={(e) => {
              setPeriod(fromMonthInput(e.target.value));
              setSelected([]);
            }}
            className="rounded-xl border border-line bg-surface p-2 text-sm text-t1"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-t2">
          세대 표기
          <Select
            aria-label="세대 표기"
            value={labelMode}
            onChange={(e) => setLabelMode(e.target.value as "code" | "name")}
            options={[
              { value: "code", label: "코드출력" },
              { value: "name", label: "이름출력" },
            ]}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-t2">
          납기일
          <input
            type="date"
            aria-label="납기일"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-xl border border-line bg-surface p-2 text-sm text-t1"
          />
        </label>
      </div>

      {!buildingId ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center text-t2">
          건물을 선택해 주세요.
        </div>
      ) : isLoading ? (
        <div className="p-8 text-center text-t2">불러오는 중…</div>
      ) : (
        <BillTargetTable
          targets={rows}
          unitLabelMode={labelMode}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onPrint={onPrint}
          onSend={() => setSendOpen(true)}
        />
      )}

      <MessagingModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        preset={{
          context: "고지서",
          channel: "sms",
          body: "관리비 고지서를 안내드립니다.",
          recipients,
        }}
        onSent={(r) => {
          setSendOpen(false);
          toast.success(`${r.count}세대에 발송(stub)했습니다`);
        }}
      />
    </div>

      {/* 인쇄 뷰는 print:hidden 컨테이너 밖(형제)에 둔다 — 인쇄 시 화면 UI만 숨기고 이 뷰만 노출.
          안에 두면 조상의 display:none이 print:block을 덮어 A4가 백지로 인쇄됨. */}
      {building && documents && (
        <BillPrintView
          buildingName={building.name}
          period={period}
          unitLabelMode={labelMode}
          dueDate={dueDate || null}
          accounts={printableAccounts(config)}
          customerNotice={config?.customerNotice ?? null}
          documents={documents}
        />
      )}
    </>
  );
}
