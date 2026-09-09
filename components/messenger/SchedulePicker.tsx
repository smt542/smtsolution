"use client";

import { useState } from "react";
import styles from "./messenger.module.css";

export interface ScheduleValue {
  scheduledAt: string | null;
}

interface SchedulePickerProps {
  value: ScheduleValue;
  onChange: (value: ScheduleValue) => void;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function defaultKstParts(): { date: string; time: string } {
  const next = new Date(Date.now() + 10 * 60_000);
  const rounded = new Date(Math.ceil(next.getTime() / (5 * 60_000)) * 5 * 60_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(rounded);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${value.year}-${value.month}-${value.day}`,
    time: `${value.hour}:${value.minute}`,
  };
}

function scheduledParts(value: string | null): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const direct = value.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?\+09:00$/,
  );
  if (direct) return { date: direct[1], time: direct[2] };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${mapped.year}-${mapped.month}-${mapped.day}`,
    time: `${mapped.hour}:${mapped.minute}`,
  };
}

function toKstIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }
  return `${date}T${time}:00+09:00`;
}

export function SchedulePicker({ value, onChange }: SchedulePickerProps) {
  const [minimumDate] = useState(() => defaultKstParts().date);
  const enabled = value.scheduledAt !== null;
  const parts = scheduledParts(value.scheduledAt);

  const toggle = () => {
    if (enabled) {
      onChange({ scheduledAt: null });
      return;
    }
    const next = defaultKstParts();
    onChange({ scheduledAt: toKstIso(next.date, next.time) });
  };

  return (
    <div className={styles["fmp-resv"]}>
      <button
        type="button"
        className={`${styles["fmp-ck"]} ${enabled ? styles.on : ""}`}
        onClick={toggle}
        aria-pressed={enabled}
      >
        <span className={styles.box} aria-hidden="true" />
        예약 전송
      </button>
      {enabled && (
        <div className={styles["fmp-dt"]}>
          <label className={`${styles["fmp-dpick"]} ${!parts.date ? styles.ph : ""}`}>
            <svg
              className={styles.ic}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
              <path d="M3 9h18M8 3v3M16 3v3" />
            </svg>
            <input
              className={styles["fmp-tel"]}
              type="date"
              value={parts.date}
              min={minimumDate}
              aria-label="예약 날짜"
              onChange={(event) =>
                onChange({
                  scheduledAt: toKstIso(event.target.value, parts.time),
                })
              }
            />
          </label>
          <label className={`${styles["fmp-dpick"]} ${!parts.time ? styles.ph : ""}`}>
            <svg
              className={styles.ic}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5V12l3 2" />
            </svg>
            <input
              className={styles["fmp-tel"]}
              type="time"
              step={300}
              value={parts.time}
              aria-label="예약 시간"
              onChange={(event) =>
                onChange({
                  scheduledAt: toKstIso(parts.date, event.target.value),
                })
              }
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function formatScheduledAt(value: string | null): string {
  if (!value) return "즉시 발송";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(parsed);
  const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${mapped.year}.${pad(Number(mapped.month))}.${pad(Number(mapped.day))} (${mapped.weekday}) ${mapped.dayPeriod} ${mapped.hour}:${mapped.minute}`;
}
