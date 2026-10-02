"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import OnboardingPageScaffold from "@/app/(resident)/_components/OnboardingPageScaffold";
import { PhoneIcon } from "@/components/icons";
import { useResidentPendingContact } from "@/hooks/reactquery/residentClaims";
import { formatPhone, normalizePhone } from "@/lib/format";
import {
  getPendingInfo,
  type PendingInfo,
} from "@/lib/resident/onboardingClient";
import {
  ResidentButton,
  residentButtonClass,
} from "@/app/(resident)/_components/ResidentButton";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatRequestedAt(value: string): string {
  const date = new Date(value);

  return `${date.getFullYear()}.${pad2(date.getMonth() + 1)}.${pad2(
    date.getDate(),
  )} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function ResidentPendingClient({
  title,
  lead,
  icon,
}: {
  title: ReactNode;
  lead: ReactNode;
  icon: ReactNode;
}) {
  const router = useRouter();
  const [pendingInfo, setPendingInfo] = useState<PendingInfo | null>(null);
  const { data: contact } = useResidentPendingContact(pendingInfo !== null);

  useEffect(() => {
    let cancelled = false;

    const loadPendingInfo = async () => {
      const pending = getPendingInfo();

      if (!pending) {
        router.replace("/resident/login");
        return;
      }

      await Promise.resolve();

      if (!cancelled) {
        setPendingInfo(pending);
      }
    };

    void loadPendingInfo();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!pendingInfo) return null;

  const household =
    `${pendingInfo.buildingName} ${pendingInfo.unitNo}`.trim() ||
    "건물 확인 요청";
  // 대표 전화가 없으면 걸 번호가 없으니 문의 카드를 숨긴다.
  const contactDigits = contact?.companyPhone
    ? normalizePhone(contact.companyPhone)
    : "";

  return (
    <OnboardingPageScaffold
      variant="center"
      title={title}
      lead={lead}
      icon={icon}
      footer={
        <ResidentButton
          variant="primary"
          size="xl"
          type="button"
          className="w-full leading-[normal]"
          onClick={() => router.push("/resident/login")}
        >
          로그인 화면으로
        </ResidentButton>
      }
    >
      <div className="mt-[26px] w-full rounded-[18px] border border-line px-4 py-1.5 text-left leading-[normal] animate-[rise_0.5s_160ms_cubic-bezier(0.22,0.61,0.36,1)_both]">
        <div className="flex items-center justify-between gap-2.5 border-b border-line2 py-3.5 text-[13.5px] font-semibold text-t3 last:border-b-0">
          <span>요청 세대</span>
          <b className="text-[14px] font-bold text-t1">{household}</b>
        </div>
        <div className="flex items-center justify-between gap-2.5 py-3.5 text-[13.5px] font-semibold text-t3">
          <span>요청 일시</span>
          <b className="text-[14px] font-bold text-t1 tabular-nums">
            {formatRequestedAt(pendingInfo.requestedAt)}
          </b>
        </div>
      </div>
      {contact && contactDigits ? (
        <div className="mt-3.5 flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-[15px] text-left leading-[normal] animate-[rise_0.5s_280ms_cubic-bezier(0.22,0.61,0.36,1)_both]">
          <div className="flex size-[38px] flex-none items-center justify-center rounded-[13px] bg-bg text-blue">
            <PhoneIcon className="size-[19px]" />
          </div>
          <div className="min-w-0 flex-1">
            <b className="block text-[14.5px] font-bold">급하면 바로 문의하세요</b>
            <span className="mt-[3px] block text-[12.5px] font-semibold text-t3 tabular-nums">
              {contact.companyName} · {formatPhone(contactDigits)}
            </span>
          </div>
          <a
            href={`tel:${contactDigits}`}
            className={residentButtonClass({ size: "call", variant: "outline" })}
          >
            전화
          </a>
        </div>
      ) : null}
    </OnboardingPageScaffold>
  );
}
