"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMe } from "@/hooks/reactquery/auth";
import { applyMask, phoneMask, PHONE_INPUT_ATTRS } from "@/components/common";
import {
  useSaveSetupSender,
  useSetupConfig,
} from "@/hooks/reactquery/setupConfig";
import { formatPhone } from "@/lib/format";
import { messengerClasses as styles } from "./messengerClasses";

interface SenderSelectProps {
  value: string;
  onChange: (value: string) => void;
}

interface SenderOption {
  number: string;
  label: string;
  detail: string;
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

export function SenderSelect({ value, onChange }: SenderSelectProps) {
  const { data: me } = useMe();
  const { data: config } = useSetupConfig(me?.orgId);
  const saveSender = useSaveSetupSender();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [verifiedDirect, setVerifiedDirect] = useState("");
  const [menuPosition, setMenuPosition] = useState<
    { left: number; top: number; width: number } | undefined
  >();
  const rootRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const initializedRef = useRef(false);
  const normalizedValue = digits(value);
  const orgSender = digits(config?.smsSender ?? "");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (config === undefined || initializedRef.current) return;
    initializedRef.current = true;
    if (!normalizedValue && orgSender) onChangeRef.current(orgSender);
  }, [config, normalizedValue, orgSender]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const options = useMemo<SenderOption[]>(() => {
    const registered: SenderOption[] = [];
    if (orgSender) {
      registered.push({
        number: orgSender,
        label: "관리업체 등록번호",
        detail: "팝빌 등록 확인",
      });
    }
    if (verifiedDirect && verifiedDirect !== orgSender) {
      registered.push({
        number: verifiedDirect,
        label: "직접 등록번호",
        detail: "팝빌 등록 확인",
      });
    }
    if (
      normalizedValue &&
      normalizedValue !== orgSender &&
      normalizedValue !== verifiedDirect
    ) {
      registered.push({
        number: normalizedValue,
        label: "운영사 기본번호",
        detail: "현재 적용 번호",
      });
    }
    return registered;
  }, [normalizedValue, orgSender, verifiedDirect]);

  const toggleOpen = () => {
    if (!open) {
      const rect = rootRef.current?.getBoundingClientRect();
      if (rect) {
        setMenuPosition({ left: rect.left, top: rect.bottom + 6, width: rect.width });
      }
    }
    setOpen((current) => !current);
    setError("");
  };

  const choose = (number: string) => {
    onChange(number);
    setOpen(false);
    setError("");
  };

  const applyOperatorDefault = async () => {
    try {
      await saveSender.mutateAsync({ product: "sms", number: "" });
      setVerifiedDirect("");
      choose("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "기본 발신번호를 적용하지 못했습니다.");
    }
  };

  const verifyAndUse = async () => {
    const number = digits(input);
    if (number.length < 9) {
      setError("올바른 발신번호를 입력해 주세요.");
      return;
    }

    setError("");
    try {
      // 이 경로가 서버의 checkSenderRegistered(checkSenderNumber) 검증을 통과한 번호만 저장한다.
      const result = await saveSender.mutateAsync({ product: "sms", number });
      if (!result.number) {
        setError("발신번호를 확인하지 못했습니다.");
        return;
      }
      setVerifiedDirect(result.number);
      setInput("");
      choose(result.number);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "팝빌에 등록된 발신번호인지 확인해 주세요.",
      );
    }
  };

  const selectedLabel = normalizedValue
    ? options.find((option) => option.number === normalizedValue)?.label ??
      "등록 발신번호"
    : "운영사 기본번호";

  return (
    <div
      ref={rootRef}
      className={`${styles["fmp-fromsel"]} ${open ? styles.open : ""}`}
      onClick={toggleOpen}
      aria-expanded={open}
    >
      <span className={styles.v}>
        {normalizedValue ? formatPhone(normalizedValue) : "운영사 기본번호"}
      </span>
      <span className={styles["fmp-deftag"]}>
        {selectedLabel === "운영사 기본번호" ? "기본" : "등록"}
      </span>
      <svg
        className={`cv ${styles.cv}`}
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="#8B95A1"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
      <div
        className={`menu ${styles["fmp-frommenu"]}`}
        style={menuPosition}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles["fmp-fromadd"]}>
          <input
            {...PHONE_INPUT_ATTRS}
            aria-label="발신번호 직접 입력"
            placeholder="발신번호 직접 입력"
            value={input}
            onChange={(event) => {
              applyMask(event.currentTarget, phoneMask);
              setInput(event.currentTarget.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void verifyAndUse();
              }
            }}
          />
          {/* 정본 .fmp-fromadd .go — [&_.go] 훅은 리터럴 클래스가 없어 먹지 않았다(여백 없는 글자만 보였다). */}
          <button
            type="button"
            className="flex h-[38px] flex-none cursor-pointer items-center rounded-[9px] bg-blue px-3.5 text-[12.5px] font-extrabold text-white hover:bg-blue-d"
            disabled={saveSender.isPending}
            onClick={() => void verifyAndUse()}
          >
            {saveSender.isPending && saveSender.variables?.number ? "확인 중…" : "적용"}
          </button>
        </div>
        {error && (
          <div className={styles["fmp-pempty"]} role="alert">
            {error}
          </div>
        )}
        <div className={styles["fmp-fromlist"]}>
          {options.map((option) => (
            <div
              key={`${option.label}-${option.number}`}
              className={`${styles["fmp-fromrow"]} ${option.number === normalizedValue ? styles.on : ""}`}
              onClick={() => choose(option.number)}
            >
              <div style={{ minWidth: 0 }}>
                <div className={styles.num}>{formatPhone(option.number)}</div>
                <div className={styles.who}>
                  {option.label} · {option.detail}
                </div>
              </div>
              {option.number === normalizedValue && (
                <svg
                  className={styles.ck}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-blue)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
            </div>
          ))}
          <div
            className={`${styles["fmp-fromrow"]} ${!normalizedValue ? styles.on : ""}`}
            onClick={() => void applyOperatorDefault()}
          >
            <div style={{ minWidth: 0 }}>
              <div className={styles.num}>운영사 기본번호</div>
              <div className={styles.who}>미설정 시 자동 적용</div>
            </div>
            {!normalizedValue && (
              <svg
                className={styles.ck}
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-blue)"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12l5 5L20 7" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
