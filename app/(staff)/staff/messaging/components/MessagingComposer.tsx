"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, Panel, Select } from "@/components/common";
import { useAccounts } from "@/hooks/reactquery/accounts";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useOccupancies,
  useTenantList,
  type TenantListRow,
} from "@/hooks/reactquery/occupancies";
import { useQuickMessages } from "@/hooks/reactquery/quickMessages";
import { useSendMessages } from "@/hooks/reactquery/messaging";
import {
  buildSendPayload,
  type MessageRecipient,
  type MessagingPreset,
} from "@/lib/messaging/preset";

export interface MessagingComposerProps {
  preset?: MessagingPreset;
  onSent?: (result: { logId: number; count: number }) => void;
}

function recipientKey(recipient: MessageRecipient): string {
  if (recipient.ref?.occupancyId !== undefined) {
    return `tenant:${recipient.ref.occupancyId}`;
  }
  if (recipient.ref?.buildingId !== undefined && recipient.kind === "owner") {
    return `owner:${recipient.ref.buildingId}`;
  }
  if (recipient.ref?.userId !== undefined) {
    return `staff:${recipient.ref.userId}`;
  }
  return `${recipient.kind}:${recipient.phone ?? ""}:${recipient.name ?? ""}`;
}

function TenantRecipientOption({
  buildingId,
  tenant,
  selectedKeys,
  onToggle,
}: {
  buildingId: number;
  tenant: TenantListRow;
  selectedKeys: Set<string>;
  onToggle: (recipient: MessageRecipient) => void;
}) {
  const { data: occupancies = [], isLoading } = useOccupancies(tenant.unitId);
  const occupancy = occupancies.find((item) => item.id === tenant.occupancyId);
  const recipient: MessageRecipient = {
    name: tenant.tenantName,
    phone: occupancy?.phone ?? null,
    unitNo: tenant.unitNo,
    kind: "tenant",
    ref: {
      occupancyId: tenant.occupancyId ?? undefined,
      buildingId,
    },
  };
  const phoneLabel = isLoading
    ? "연락처 확인 중"
    : recipient.phone ?? "연락처 없음";

  return (
    <Checkbox
      label={`${tenant.unitNo} · ${tenant.tenantName ?? "입주자 미등록"} · ${phoneLabel}`}
      checked={selectedKeys.has(recipientKey(recipient))}
      disabled={isLoading || !recipient.phone}
      onChange={() => onToggle(recipient)}
    />
  );
}
export function MessagingComposer({
  preset,
  onSent,
}: MessagingComposerProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState(0);
  const [recipients, setRecipients] = useState<MessageRecipient[]>(() => [
    ...(preset?.recipients ?? []),
  ]);
  const [body, setBody] = useState(preset?.body ?? "");
  const [quickMessageId, setQuickMessageId] = useState("");

  const { data: buildings = [], isLoading: isBuildingsLoading } = useBuildings();
  const { data: tenants = [], isLoading: isTenantsLoading } =
    useTenantList(selectedBuildingId);
  const { data: accounts = [], isLoading: isAccountsLoading } = useAccounts();
  const { data: quickMessages = [] } = useQuickMessages();
  const sendMessages = useSendMessages();

  const selectedBuilding = buildings.find(
    (building) => building.id === selectedBuildingId,
  );
  const selectedKeys = useMemo(
    () => new Set(recipients.map(recipientKey)),
    [recipients],
  );
  const sendPayload = useMemo(
    () =>
      buildSendPayload({
        channel: "sms",
        body,
        context: preset?.context ?? "manual",
        recipients,
      }),
    [body, preset?.context, recipients],
  );
  const validCount = sendPayload.recipients.length;
  const activeAccounts = accounts.filter((account) => account.isActive);
  const occupiedTenants = tenants.filter(
    (tenant) => !tenant.isVacant && tenant.occupancyId !== null,
  );
  const canSend = validCount > 0 && body.trim().length > 0;

  const toggleRecipient = (recipient: MessageRecipient) => {
    const key = recipientKey(recipient);
    setRecipients((current) =>
      current.some((item) => recipientKey(item) === key)
        ? current.filter((item) => recipientKey(item) !== key)
        : [...current, recipient],
    );
  };

  const insertQuickMessage = (id: string) => {
    setQuickMessageId(id);
    const message = quickMessages.find((item) => String(item.id) === id);
    if (!message) return;
    setBody((current) =>
      current.trim().length > 0 ? `${current}\n${message.body}` : message.body,
    );
    setQuickMessageId("");
  };

  const send = async () => {
    if (validCount === 0) {
      toast.info("수신처를 선택해 주세요.");
      return;
    }
    if (body.trim().length === 0) {
      toast.info("본문을 입력해 주세요.");
      return;
    }
    if (!window.confirm(`${validCount}명에게 발송하시겠습니까?`)) return;

    try {
      const result = await sendMessages.mutateAsync(sendPayload);
      toast.success(`발송(임시) 완료 · ${result.count}명`);
      onSent?.(result);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "발송하지 못했습니다.",
      );
    }
  };

  const ownerRecipient: MessageRecipient | null = selectedBuilding
    ? {
        name: selectedBuilding.ownerName,
        phone: selectedBuilding.ownerPhone,
        kind: "owner",
        ref: { buildingId: selectedBuilding.id },
      }
    : null;

  return (
    <Panel
      title="문자 발송"
      action={
        <span className="rounded-lg bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
          {validCount}명
        </span>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-xs font-bold text-t2">채널</span>
            <div className="flex h-11 items-center rounded-xl border border-line bg-bg px-4 text-sm font-bold text-t1">
              SMS
            </div>
          </div>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">
              건물 선택
            </span>
            <Select
              aria-label="건물 선택"
              value={String(selectedBuildingId || "")}
              disabled={isBuildingsLoading}
              onChange={(event) =>
                setSelectedBuildingId(Number(event.target.value) || 0)
              }
              options={[
                { value: "", label: "건물을 선택해 주세요" },
                ...buildings.map((building) => ({
                  value: String(building.id),
                  label: building.name,
                })),
              ]}
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <section
            aria-labelledby="tenant-recipient-title"
            className="rounded-xl border border-line p-4"
          >
            <h4
              id="tenant-recipient-title"
              className="mb-3 text-sm font-extrabold text-t1"
            >
              세대
            </h4>
            {!selectedBuilding && (
              <p className="text-sm text-t4">건물을 먼저 선택해 주세요.</p>
            )}
            {selectedBuilding && isTenantsLoading && (
              <p className="text-sm text-t4">세대 목록을 불러오는 중입니다.</p>
            )}
            {selectedBuilding &&
              !isTenantsLoading &&
              occupiedTenants.length === 0 && (
                <p className="text-sm text-t4">선택할 입주 세대가 없습니다.</p>
              )}
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {occupiedTenants.map((tenant) => (
                <TenantRecipientOption
                  key={tenant.unitId}
                  buildingId={selectedBuildingId}
                  tenant={tenant}
                  selectedKeys={selectedKeys}
                  onToggle={toggleRecipient}
                />
              ))}
            </div>
          </section>

          <section
            aria-labelledby="owner-recipient-title"
            className="rounded-xl border border-line p-4"
          >
            <h4
              id="owner-recipient-title"
              className="mb-3 text-sm font-extrabold text-t1"
            >
              건물주
            </h4>
            {!ownerRecipient ? (
              <p className="text-sm text-t4">건물을 먼저 선택해 주세요.</p>
            ) : (
              <Checkbox
                label={`${ownerRecipient.name ?? "건물주"} · ${ownerRecipient.phone ?? "연락처 없음"}`}
                checked={selectedKeys.has(recipientKey(ownerRecipient))}
                disabled={!ownerRecipient.phone}
                onChange={() => toggleRecipient(ownerRecipient)}
              />
            )}
          </section>

          <section
            aria-labelledby="staff-recipient-title"
            className="rounded-xl border border-line p-4"
          >
            <h4
              id="staff-recipient-title"
              className="mb-3 text-sm font-extrabold text-t1"
            >
              직원
            </h4>
            {isAccountsLoading && (
              <p className="text-sm text-t4">직원 목록을 불러오는 중입니다.</p>
            )}
            {!isAccountsLoading && activeAccounts.length === 0 && (
              <p className="text-sm text-t4">선택할 직원이 없습니다.</p>
            )}
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {activeAccounts.map((account) => {
                const recipient: MessageRecipient = {
                  name: account.fullName,
                  phone: account.phone,
                  kind: "staff",
                  ref: { userId: account.userId },
                };
                return (
                  <Checkbox
                    key={account.userId}
                    label={`${account.fullName} · ${account.phone ?? "연락처 없음"}`}
                    checked={selectedKeys.has(recipientKey(recipient))}
                    disabled={!recipient.phone}
                    onChange={() => toggleRecipient(recipient)}
                  />
                );
              })}
            </div>
          </section>
        </div>

        {recipients.length > 0 && (
          <section aria-label="선택된 수신처">
            <h4 className="mb-2 text-xs font-bold text-t2">선택된 수신처</h4>
            <div className="flex flex-wrap gap-2">
              {recipients.map((recipient, index) => (
                <span
                  key={`${recipientKey(recipient)}:${index}`}
                  className="rounded-lg bg-bg px-2.5 py-1 text-xs text-t2"
                >
                  {recipient.unitNo ? `${recipient.unitNo} · ` : ""}
                  {recipient.name ?? "이름 없음"}
                  {recipient.phone ? ` · ${recipient.phone}` : " · 연락처 없음"}
                </span>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">본문</span>
            <textarea
              aria-label="본문"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="발송할 문자 내용을 입력해 주세요."
              className="min-h-36 w-full rounded-xl border border-line bg-surface p-4 text-sm text-t1 placeholder:text-t4 focus:border-brand focus:outline-none"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">
              자주 보내는 문자
            </span>
            <Select
              aria-label="자주 보내는 문자"
              value={quickMessageId}
              onChange={(event) => insertQuickMessage(event.target.value)}
              options={[
                { value: "", label: "문구를 선택해 주세요" },
                ...quickMessages.map((message) => ({
                  value: String(message.id),
                  label: message.title,
                })),
              ]}
            />
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <p className="text-sm text-t3">
            연락처가 있는 수신처 <strong className="text-t1">{validCount}명</strong>
          </p>
          <Button
            type="button"
            onClick={send}
            disabled={sendMessages.isPending}
            aria-disabled={!canSend || sendMessages.isPending}
            className={!canSend ? "opacity-70" : ""}
          >
            {sendMessages.isPending ? "발송 중…" : "발송"}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
