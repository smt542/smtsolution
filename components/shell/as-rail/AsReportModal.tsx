"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { COMPLAINT_STATUS_LABEL } from "@/app/(staff)/staff/(app)/receipts/constants";
import { useAccounts } from "@/hooks/reactquery/accounts";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useComplaints } from "@/hooks/reactquery/complaints";

import { hhmm, ymd } from "./constants";
import styles from "./AsReportModal.module.css";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const PRINT_SHEET_ID = "aspPrintSheet";
const PRINT_STYLE_ID = "aspPrintCss";

const pad = (value: number) => String(value).padStart(2, "0");

function toDateKey(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dotted(value: string) {
  return value.replaceAll("-", ".");
}

function dateParts(value: string) {
  const [year, month] = value.split("-").map(Number);
  return { year, month: month - 1 };
}

interface DatePickerProps {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
}

function DatePicker({ ariaLabel, value, onChange }: DatePickerProps) {
  const initial = dateParts(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const rootRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const placePopup = useCallback(() => {
    const control = controlRef.current;
    const popup = popupRef.current;
    if (!control || !popup) return;

    const rect = control.getBoundingClientRect();
    const height = popup.offsetHeight || 300;
    const width = popup.offsetWidth || 262;
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top:
        rect.bottom + height + 8 > window.innerHeight
          ? Math.max(8, rect.top - height - 6)
          : rect.bottom + 6,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) placePopup();
  }, [open, placePopup, viewMonth, viewYear]);

  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    window.addEventListener("resize", placePopup);
    window.addEventListener("scroll", placePopup, true);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      window.removeEventListener("resize", placePopup);
      window.removeEventListener("scroll", placePopup, true);
    };
  }, [open, placePopup]);

  const toggle = () => {
    if (!open) {
      const selected = dateParts(value);
      setViewYear(selected.year);
      setViewMonth(selected.month);
    }
    setOpen((current) => !current);
  };

  const moveMonth = (offset: number) => {
    const next = new Date(viewYear, viewMonth + offset, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const dayCount = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: dayCount }, (_, index) => index + 1),
  ];

  return (
    <div
      ref={rootRef}
      className={`${styles.aspDp} ${open ? styles.open : ""}`}
    >
      <button
        ref={controlRef}
        type="button"
        className={styles.aspDpCtl}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
          <path d="M3 9h18M8 3v3M16 3v3" />
        </svg>
        <span>{value ? dotted(value) : "날짜 선택"}</span>
      </button>
      <div
        ref={popupRef}
        className={styles.aspDpPop}
        role="dialog"
        aria-label={`${ariaLabel} 달력`}
        style={position}
      >
        <div className={styles.aspDpHead}>
          <button
            type="button"
            className={styles.aspDpNav}
            aria-label="이전 달"
            onClick={() => moveMonth(-1)}
          >
            ‹
          </button>
          <div className={styles.aspDpTitle}>
            {viewYear}.{pad(viewMonth + 1)}
          </div>
          <button
            type="button"
            className={styles.aspDpNav}
            aria-label="다음 달"
            onClick={() => moveMonth(1)}
          >
            ›
          </button>
        </div>
        <div className={styles.aspDpWk}>
          {WEEKDAYS.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <div className={styles.aspDpGrid}>
          {cells.map((day, index) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${index}`}
                  className={styles.aspDpCell}
                  aria-hidden="true"
                />
              );
            }
            const dateValue = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
            const selected = value === dateValue;
            return (
              <button
                key={dateValue}
                type="button"
                className={`${styles.aspDpCell} ${styles.aspDpDay} ${selected ? styles.sel : ""}`}
                aria-label={`${viewYear}년 ${viewMonth + 1}월 ${day}일`}
                aria-pressed={selected}
                onClick={() => {
                  onChange(dateValue);
                  setOpen(false);
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ReportRow {
  id: number;
  receivedDate: string;
  receivedDateKey: string;
  completedDate: string;
  completedDateKey: string;
  rangeDateKey: string;
  buildingName: string;
  address: string;
  unit: string;
  time: string;
  category: string;
  content: string;
  reporterPhone: string;
  status: string;
  receiver: string;
  assignee: string;
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function AsReportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const today = useMemo(() => toDateKey(new Date()), []);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const titleId = useId();
  const tableRef = useRef<HTMLTableElement>(null);

  const complaintsQuery = useComplaints();
  const buildingsQuery = useBuildings();
  const accountsQuery = useAccounts();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, open]);

  const buildingById = useMemo(
    () =>
      new Map(
        (buildingsQuery.data ?? []).map((building) => [building.id, building]),
      ),
    [buildingsQuery.data],
  );
  const accountNameById = useMemo(
    () =>
      new Map(
        (accountsQuery.data ?? []).map((account) => [
          account.userId,
          account.fullName,
        ]),
      ),
    [accountsQuery.data],
  );

  const rows = useMemo<ReportRow[]>(
    () =>
      (complaintsQuery.data ?? []).map((complaint) => {
        const building = buildingById.get(complaint.buildingId);
        const completedAt =
          complaint.completedAt ?? complaint.resolutions[0]?.resolvedAt;
        const receivedDateKey = toDateKey(complaint.receivedAt);
        const completedDateKey = toDateKey(completedAt);
        const unit = `${complaint.unitDong ?? ""}${complaint.unitNo ?? ""}`;
        return {
          id: complaint.id,
          receivedDate: ymd(complaint.receivedAt),
          receivedDateKey,
          completedDate: ymd(completedAt),
          completedDateKey,
          rangeDateKey: completedDateKey || receivedDateKey,
          buildingName: complaint.buildingName ?? building?.name ?? "-",
          address: building?.address ?? "-",
          unit: unit || "-",
          time: hhmm(complaint.receivedAt),
          category: complaint.categoryLabel ?? "-",
          content: complaint.content?.trim() || complaint.title,
          reporterPhone: complaint.reporterPhone ?? "-",
          status: COMPLAINT_STATUS_LABEL[complaint.status],
          receiver: complaint.createdBy
            ? accountNameById.get(complaint.createdBy) ?? "-"
            : "-",
          assignee: complaint.assignedTo
            ? accountNameById.get(complaint.assignedTo) ?? "-"
            : "-",
        };
      }),
    [accountNameById, buildingById, complaintsQuery.data],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ko-KR");
    return rows
      .filter((row) => {
        const searchTarget = `${row.buildingName}${row.address}${row.unit}`;
        return (
          (!query ||
            searchTarget.toLocaleLowerCase("ko-KR").includes(query)) &&
          (!from || row.rangeDateKey >= from) &&
          (!to || row.rangeDateKey <= to)
        );
      })
      .sort((left, right) => {
        const dateCompared = right.rangeDateKey.localeCompare(
          left.rangeDateKey,
        );
        if (dateCompared !== 0) return dateCompared;
        const receivedCompared = right.receivedDateKey.localeCompare(
          left.receivedDateKey,
        );
        return receivedCompared !== 0 ? receivedCompared : right.id - left.id;
      });
  }, [from, rows, search, to]);

  const meta = `[시행일 : ${dotted(from)}] 부터 ${dotted(to)}`;
  const isLoading =
    complaintsQuery.isLoading ||
    buildingsQuery.isLoading ||
    accountsQuery.isLoading;
  const isError =
    complaintsQuery.isError || buildingsQuery.isError || accountsQuery.isError;

  const downloadCsv = () => {
    const header = [
      "NO",
      "접수일",
      "시행일",
      "빌라명",
      "주소",
      "호실",
      "시간",
      "A/S분류",
      "접수내용",
      "접수시전화",
      "처리결과",
      "접수담당",
      "처리담당",
    ];
    const csv = [
      header.join(","),
      ...filteredRows.map((row, index) =>
        [
          index + 1,
          row.receivedDate,
          row.completedDateKey ? row.completedDate : "",
          row.buildingName,
          row.address,
          row.unit,
          row.time,
          row.category,
          row.content,
          row.reporterPhone,
          row.status,
          row.receiver,
          row.assignee,
        ]
          .map(csvCell)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `A_S접수현황 ${from}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const printReport = () => {
    document.getElementById(PRINT_SHEET_ID)?.remove();
    document.getElementById(PRINT_STYLE_ID)?.remove();

    const style = document.createElement("style");
    style.id = PRINT_STYLE_ID;
    style.textContent =
      "@media screen{#aspPrintSheet{display:none}}" +
      "@media print{@page{size:A4 landscape;margin:10mm}" +
      "html,body{background:#fff!important;height:auto!important;overflow:visible!important}" +
      "body>*:not(#aspPrintSheet){display:none!important}" +
      "#aspPrintSheet{display:block!important;background:#fff!important;color:#000}" +
      "#aspPrintSheet h1{text-align:center;font-size:14pt;font-weight:800;letter-spacing:.14em;margin:0 0 4mm}" +
      "#aspPrintSheet .m{font-size:9pt;font-weight:700;margin-bottom:2.5mm}" +
      "#aspPrintSheet table{width:100%;border-collapse:collapse;font-size:8pt}" +
      "#aspPrintSheet th,#aspPrintSheet td{border:.6pt solid #000;padding:1.2mm 1.6mm}" +
      "#aspPrintSheet thead th{background:#EDEDED;text-align:center;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      "#aspPrintSheet thead{display:table-header-group}#aspPrintSheet tr{page-break-inside:avoid}" +
      "#aspPrintSheet td.c{text-align:center}#aspPrintSheet td span{display:block;margin-top:1px}" +
      "}";
    document.head.appendChild(style);

    const sheet = document.createElement("div");
    sheet.id = PRINT_SHEET_ID;
    const heading = document.createElement("h1");
    heading.textContent = "[ A/S 접수 현황 ]";
    const metadata = document.createElement("div");
    metadata.className = "m";
    metadata.textContent = meta;
    const table = tableRef.current?.cloneNode(true) as HTMLTableElement | null;
    if (table) {
      table.removeAttribute("class");
      table.querySelectorAll("td").forEach((cell) => {
        cell.className = cell.classList.contains(styles.c) ? "c" : "";
      });
      table.querySelectorAll("span").forEach((span) => span.removeAttribute("class"));
    }
    sheet.append(heading, metadata);
    if (table) sheet.appendChild(table);
    document.body.appendChild(sheet);

    window.setTimeout(() => {
      try {
        window.print();
      } catch {
        // Printing may be unavailable in embedded browser contexts.
      }
      window.setTimeout(() => {
        sheet.remove();
        style.remove();
      }, 800);
    }, 250);
  };

  if (!open) return null;

  let stateMessage = "";
  if (isLoading) stateMessage = "A/S 접수 내역을 불러오는 중이에요";
  else if (isError) stateMessage = "A/S 접수 내역을 불러오지 못했어요";
  else if (filteredRows.length === 0)
    stateMessage = "조회된 A/S 접수 내역이 없어요";

  return (
    <div
      className={`${styles.aspScrim} ${styles.show}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={styles.aspModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.aspHead}>
          <h2 id={titleId} className={styles.aspT}>
            A/S 접수 현황 출력
          </h2>
          <button
            type="button"
            className={styles.aspX}
            aria-label="A/S 접수 현황 출력 닫기"
            onClick={onClose}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className={styles.aspBar}>
          <div className={styles.aspSrch}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
            <input
              aria-label="A/S 접수 현황 검색"
              placeholder="건물명·주소·호실 검색"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <span className={styles.aspLbl}>시행일 기간</span>
          <DatePicker
            ariaLabel="시행일 시작 날짜"
            value={from}
            onChange={setFrom}
          />
          <span className={styles.aspTilde}>~</span>
          <DatePicker
            ariaLabel="시행일 종료 날짜"
            value={to}
            onChange={setTo}
          />
        </div>
        <div className={styles.aspSheet}>
          <h1>[ A/S 접수 현황 ]</h1>
          <div className={styles.aspMeta}>{meta}</div>
          <table ref={tableRef} className={styles.aspTbl}>
            <thead>
              <tr>
                <th style={{ width: 34 }}>NO</th>
                <th style={{ width: 78 }}>
                  접수일
                  <br />
                  시행일
                </th>
                <th style={{ width: 150 }}>
                  빌라명
                  <br />
                  주소
                </th>
                <th style={{ width: 58 }}>
                  호실
                  <br />
                  시간
                </th>
                <th style={{ width: 84 }}>유형</th>
                <th>접수내용</th>
                <th style={{ width: 104 }}>입주자 전화번호</th>
                <th style={{ width: 70 }}>처리결과</th>
                <th style={{ width: 84 }}>
                  접수자
                  <br />
                  처리자
                </th>
              </tr>
            </thead>
            <tbody>
              {!isLoading &&
                !isError &&
                filteredRows.map((row, index) => (
                  <tr key={row.id}>
                    <td className={styles.c}>{index + 1}</td>
                    <td className={styles.c}>
                      {row.receivedDate}
                      <span className={styles.aspSub2}>
                        {row.completedDate}
                      </span>
                    </td>
                    <td>
                      {row.buildingName}
                      <span className={styles.aspSub2}>{row.address}</span>
                    </td>
                    <td className={styles.c}>
                      {row.unit}
                      <span className={styles.aspSub2}>{row.time}</span>
                    </td>
                    <td className={styles.c}>{row.category}</td>
                    <td>{row.content}</td>
                    <td className={styles.c}>{row.reporterPhone}</td>
                    <td className={styles.c}>{row.status}</td>
                    <td className={styles.c}>
                      {row.receiver}
                      <span className={styles.aspSub2}>{row.assignee}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {stateMessage && (
            <div className={styles.aspEmpty}>{stateMessage}</div>
          )}
        </div>
        <div className={styles.aspFoot}>
          <button
            type="button"
            className={styles.aspBtn}
            onClick={downloadCsv}
          >
            엑셀 다운로드
          </button>
          <button
            type="button"
            className={`${styles.aspBtn} ${styles.pri}`}
            onClick={printReport}
          >
            인쇄
          </button>
        </div>
      </section>
    </div>
  );
}
