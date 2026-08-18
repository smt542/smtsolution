"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, Panel, Select } from "@/components/common";
import { useAccounts } from "@/hooks/reactquery/accounts";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useMessageTemplates } from "@/hooks/reactquery/messageTemplates";
import {
  useSendMessages,
  useTenantAlimtalkConsent,
} from "@/hooks/reactquery/messaging";
import {
  useTenantList,
  type TenantListRow,
} from "@/hooks/reactquery/occupancies";
import { useQuickMessages } from "@/hooks/reactquery/quickMessages";
import { renderTemplate } from "@/lib/messaging/render";
import {
  dedupeRecipients,
  validRecipients,
  type MessageChannel,
  type MessageRecipient,
  type MessagingPreset,
  type ResolvedRecipient,
  type SendMode,
} from "@/lib/messaging/preset";

export interface MessagingComposerProps {
  preset?: MessagingPreset;
  initialMode?: SendMode;
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
  const recipient: MessageRecipient = {
    name: tenant.tenantName,
    phone: tenant.phone,
    unitNo: tenant.unitNo,
    kind: "tenant",
    ref: {
      occupancyId: tenant.occupancyId ?? undefined,
      buildingId,
    },
  };
  const phoneLabel = recipient.phone ?? "연락처 없음";

  return (
    <Checkbox
      label={`${tenant.unitNo} · ${tenant.tenantName ?? "입주자 미등록"} · ${phoneLabel}`}
      checked={selectedKeys.has(recipientKey(recipient))}
      disabled={!recipient.phone}
      onChange={() => onToggle(recipient)}
    />
  );
}
export function MessagingComposer({
  preset,
  initialMode,
  onSent,
}: MessagingComposerProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState(0);
  const [recipients, setRecipients] = useState<MessageRecipient[]>(() => [
    ...(preset?.recipients ?? []),
  ]);
  const [mode, setMode] = useState<SendMode>(
    initialMode ?? preset?.mode ?? "auto",
  );
  const [templateId, setTemplateId] = useState<number | null>(
    preset?.templateId ?? null,
  );
  const [body, setBody] = useState(preset?.body ?? "");
  const [quickMessageId, setQuickMessageId] = useState("");

  const { data: buildings = [], isLoading: isBuildingsLoading } = useBuildings();
  const { data: tenants = [], isLoading: isTenantsLoading } =
    useTenantList(selectedBuildingId);
  const { data: accounts = [], isLoading: isAccountsLoading } = useAccounts();
  const { data: quickMessages = [] } = useQuickMessages();
  const { data: templates = [], isLoading: isTemplatesLoading } =
    useMessageTemplates();
  const { data: tenantConsents = [] } =
    useTenantAlimtalkConsent(selectedBuildingId);
  const sendMessages = useSendMessages();

  const selectedBuilding = buildings.find(
    (building) => building.id === selectedBuildingId,
  );
  const selectedKeys = useMemo(
    () => new Set(recipients.map(recipientKey)),
    [recipients],
  );
  const consentByOccupancy = useMemo(
    () =>
      new Map(
        tenantConsents.map((consent) => [
          consent.occupancyId,
          consent.alimtalkOptIn,
        ]),
      ),
    [tenantConsents],
  );
  const validRecipientList = useMemo(
    () => validRecipients(dedupeRecipients(recipients)),
    [recipients],
  );
  const recipientPreviews = useMemo(
    () =>
      validRecipientList.map((recipient) => {
        const occupancyId = recipient.ref?.occupancyId;
        const hasAlimtalkConsent =
          occupancyId !== undefined &&
          consentByOccupancy.get(occupancyId) === true;
        const channel: MessageChannel | null =
          mode === "sms"
            ? "sms"
            : hasAlimtalkConsent
              ? "alimtalk"
              : mode === "alimtalk"
                ? null
                : "sms";
        const renderedBody = renderTemplate(body, {
          이름: recipient.name ?? "",
          호실: recipient.unitNo ?? "",
          건물명: selectedBuilding?.name ?? "",
        });

        return { recipient, channel, renderedBody };
      }),
    [body, consentByOccupancy, mode, selectedBuilding?.name, validRecipientList],
  );
  const sendRecipients = useMemo<ResolvedRecipient[]>(
    () =>
      recipientPreviews.flatMap(({ recipient, channel, renderedBody }) =>
        channel === null
          ? []
          : [{ ...recipient, channel, renderedBody }],
      ),
    [recipientPreviews],
  );
  const previewByRecipient = useMemo(
    () =>
      new Map(
        recipientPreviews.map((preview) => [
          recipientKey(preview.recipient),
          preview,
        ]),
      ),
    [recipientPreviews],
  );
  const validCount = sendRecipients.length;
  const excludedCount = validRecipientList.length - validCount;
  const activeAccounts = accounts.filter((account) => account.isActive);
  const occupiedTenants = tenants.filter(
    (tenant) => !tenant.isVacant && tenant.occupancyId !== null,
  );
  const canSend =
    validCount > 0 &&
    body.trim().length > 0 &&
    (mode === "sms" || templateId !== null);

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

  const selectTemplate = (value: string) => {
    const nextTemplateId = Number(value) || null;
    setTemplateId(nextTemplateId);
    const template = templates.find((item) => item.id === nextTemplateId);
    if (template) setBody(template.body);
  };

  const send = async () => {
    if (validRecipientList.length === 0) {
      toast.info("수신처를 선택해 주세요.");
      return;
    }
    if (body.trim().length === 0) {
      toast.info("본문을 입력해 주세요.");
      return;
    }
    if (mode !== "sms" && templateId === null) {
      toast.info("알림톡 템플릿을 선택해 주세요.");
      return;
    }
    if (mode === "alimtalk" && validCount === 0) {
      toast.info("알림톡 수신에 동의한 수신처가 없습니다.");
      return;
    }
    if (!window.confirm(`${validCount}명에게 발송하시겠습니까?`)) return;

    try {
      const result = await sendMessages.mutateAsync({
        mode,
        body,
        context: preset?.context ?? "manual",
        templateId: mode === "sms" ? null : templateId,
        recipients: sendRecipients,
      });
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
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">
              발송 모드
            </span>
            <Select
              aria-label="발송 모드"
              value={mode}
              onChange={(event) => setMode(event.target.value as SendMode)}
              options={[
                { value: "auto", label: "자동" },
                { value: "sms", label: "SMS" },
                { value: "alimtalk", label: "알림톡" },
              ]}
            />
          </label>
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

        {mode !== "sms" && (
          <label>
            <span className="mb-1.5 block text-xs font-bold text-t2">
              알림톡 템플릿
            </span>
            <Select
              aria-label="알림톡 템플릿"
              value={templateId === null ? "" : String(templateId)}
              disabled={isTemplatesLoading}
              onChange={(event) => selectTemplate(event.target.value)}
              options={[
                { value: "", label: "템플릿을 선택해 주세요" },
                ...templates.map((template) => ({
                  value: String(template.id),
                  label: template.title,
                })),
              ]}
            />
          </label>
        )}

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
              {recipients.map((recipient, index) => {
                const preview = previewByRecipient.get(recipientKey(recipient));
                const channelLabel =
                  preview?.channel === "alimtalk"
                    ? "예상 알림톡"
                    : preview?.channel === "sms"
                      ? "예상 SMS"
                      : "예상 제외";

                return (
                  <div
                    key={`${recipientKey(recipient)}:${index}`}
                    className="rounded-lg bg-bg px-2.5 py-2 text-xs text-t2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        {recipient.unitNo ? `${recipient.unitNo} · ` : ""}
                        {recipient.name ?? "이름 없음"}
                        {recipient.phone
                          ? ` · ${recipient.phone}`
                          : " · 연락처 없음"}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 font-bold ${
                          preview?.channel === null || !preview
                            ? "bg-danger/10 text-danger"
                            : "bg-brand/10 text-brand"
                        }`}
                      >
                        {channelLabel}
                      </span>
                    </div>
                    {preview && (
                      <p className="mt-1 max-w-xl whitespace-pre-wrap text-t3">
                        {preview.renderedBody}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {mode === "alimtalk" && excludedCount > 0 && (
          <p
            role="alert"
            className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
          >
            알림톡 미동의 수신처 {excludedCount}명은 제외됩니다.
          </p>
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
            발송 가능한 수신처 <strong className="text-t1">{validCount}명</strong>
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
