"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { COMPLAINT_STATUS_LABEL } from "@/app/(staff)/staff/(app)/receipts/constants";
import { Input, Spinner } from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { useAccounts } from "@/hooks/reactquery/accounts";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useComplaints } from "@/hooks/reactquery/complaints";
import { formatPhone } from "@/lib/format";

import { hhmm, ymd } from "./constants";
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

interface DatePickerProps {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
}

function DatePicker({ ariaLabel, value, onChange }: DatePickerProps) {
  return (
    <DpDatePicker
      ariaLabel={ariaLabel}
      value={value}
      onChange={onChange}
      placeholder="날짜 선택"
      triggerClassName="flex items-center gap-[7px] h-[34px] px-[11px] border border-line rounded-[9px] bg-white cursor-pointer text-[13px] font-semibold text-t1 whitespace-nowrap"
      triggerOpenClassName="border-blue shadow-[0_0_0_3px_var(--color-blue-t)]"
      startAdornment={(
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          aria-hidden="true"
          className="w-[14px] h-[14px] text-t3 flex-none"
        >
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
          <path d="M3 9h18M8 3v3M16 3v3" />
        </svg>
      )}
    />
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
          reporterPhone: complaint.reporterPhone?.trim()
            ? formatPhone(complaint.reporterPhone)
            : "-",
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
  const isReportDataLoading =
    complaintsQuery.isLoading ||
    buildingsQuery.isLoading ||
    accountsQuery.isLoading;
  const isReportDataRefreshing = [complaintsQuery, buildingsQuery, accountsQuery]
    .some((query) => query.isFetching && !query.isLoading);
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
        cell.className = cell.classList.contains("text-center") ? "c" : "";
      });
      table.querySelector("tbody")?.querySelectorAll("tr").forEach((row, index) => {
        const phoneCell = row.cells[6];
        if (phoneCell) phoneCell.textContent = filteredRows[index]?.reporterPhone ?? "";
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
  if (isReportDataLoading) stateMessage = "A/S 접수 내역을 불러오는 중이에요";
  else if (isError) stateMessage = "A/S 접수 내역을 불러오지 못했어요";
  else if (filteredRows.length === 0)
    stateMessage = "조회된 A/S 접수 내역이 없어요";

  return (
    <div
      className="asp-scrim show fixed inset-0 z-[500] flex items-center justify-center bg-scrim p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="asp-modal w-[min(1180px,96vw)] max-h-[calc(100vh_-_48px)] flex flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.4)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div
          className="asp-head flex flex-none items-center gap-3 border-b border-line px-[22px] py-[18px]"
        >
          <h2 id={titleId} className="text-[17px] font-extrabold text-t1">
            A/S 접수 현황 출력
          </h2>
          <button
            type="button"
            className="ml-auto w-8 h-8 rounded-[9px] flex items-center justify-center text-t3 cursor-pointer hover:bg-bg"
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
              className="w-4 h-4"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div
          className="asp-bar flex flex-none flex-wrap items-center gap-2 border-b border-line px-[22px] py-[14px]"
        >
          <div className="relative flex items-center flex-[0_0_260px]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="w-[15px] h-[15px] absolute left-[11px] text-t4"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
            <Input
              unstyled
              aria-label="A/S 접수 현황 검색"
              placeholder="건물명·주소·호실 검색"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full h-[34px] border border-line rounded-[9px] pl-8 pr-[11px] py-0 text-[13px] font-semibold text-t1 outline-none bg-white focus:border-blue focus:shadow-[0_0_0_3px_var(--color-blue-t)]"
            />
          </div>
          <span className="text-[12.5px] font-bold text-t3 ml-[6px]">
            시행일 기간
          </span>
          <DatePicker
            ariaLabel="시행일 시작 날짜"
            value={from}
            onChange={setFrom}
          />
          <span className="text-t4 font-bold">~</span>
          <DatePicker
            ariaLabel="시행일 종료 날짜"
            value={to}
            onChange={setTo}
          />
        </div>
        <div
          className="asp-sheet relative min-h-[360px] flex-[1_1_auto] overflow-auto px-[22px] py-5"
        >
          {isReportDataRefreshing ? (
            <div className="absolute right-5 top-4 rounded-lg bg-white/95 shadow-card">
              <Spinner label="A/S 접수 내역 갱신 중" size="small" showLabel className="px-3 py-2" />
            </div>
          ) : null}
          <h1 className="mb-2.5 text-center text-[17px] font-extrabold tracking-[0.14em]">[ A/S 접수 현황 ]</h1>
          <div className="text-[12.5px] font-bold text-t2 mb-2">{meta}</div>
          <table ref={tableRef} className="asp-table w-full border-collapse text-[11.5px] [&_th]:border [&_th]:border-[#C8CCD0] [&_th]:bg-[#F1F3F5] [&_th]:px-1.5 [&_th]:py-[5px] [&_th]:text-center [&_th]:font-bold [&_th]:leading-[1.35] [&_td]:border [&_td]:border-[#C8CCD0] [&_td]:px-1.5 [&_td]:py-[5px] [&_td]:align-middle [&_td]:text-t1 [&_td_span]:mt-0.5 [&_td_span]:block">
            <thead>
              <tr>
                <th className="w-[34px]">NO</th>
                <th className="w-[78px]">
                  접수일
                  <br />
                  시행일
                </th>
                <th className="w-[150px]">
                  빌라명
                  <br />
                  주소
                </th>
                <th className="w-[58px]">
                  호실
                  <br />
                  시간
                </th>
                <th className="w-[84px]">유형</th>
                <th>접수내용</th>
                <th className="w-[104px]">입주자 전화번호</th>
                <th className="w-[70px]">처리결과</th>
                <th className="w-[84px]">
                  접수자
                  <br />
                  처리자
                </th>
              </tr>
            </thead>
            <tbody>
              {!isReportDataLoading &&
                !isError &&
                filteredRows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="text-center">{index + 1}</td>
                    <td className="text-center">
                      {row.receivedDate}
                      <span className="mt-0.5 block">
                        {row.completedDate}
                      </span>
                    </td>
                    <td>
                      {row.buildingName}
                      <span className="mt-0.5 block">{row.address}</span>
                    </td>
                    <td className="text-center">
                      {row.unit}
                      <span className="mt-0.5 block">{row.time}</span>
                    </td>
                    <td className="text-center">{row.category}</td>
                    <td>{row.content}</td>
                    <td className="text-center">{row.reporterPhone}</td>
                    <td className="text-center">{row.status}</td>
                    <td className="text-center">
                      {row.receiver}
                      <span className="mt-0.5 block">{row.assignee}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {stateMessage && (
            <div
              role={isError ? "alert" : isReportDataLoading ? "status" : undefined}
              aria-label={isReportDataLoading ? stateMessage : undefined}
              className="py-10 text-center text-[13.5px] font-semibold text-t4"
            >
              {stateMessage}
            </div>
          )}
        </div>
        <div
          className="asp-foot flex flex-none justify-end gap-2 border-t border-line px-[22px] pb-[18px] pt-[14px]"
        >
          <button
            type="button"
            className="h-10 px-[18px] border border-line rounded-[11px] bg-white text-[13.5px] font-bold text-t2 cursor-pointer"
            onClick={downloadCsv}
          >
            엑셀 다운로드
          </button>
          <button
            type="button"
            className="h-10 px-[18px] border border-blue rounded-[11px] bg-blue text-[13.5px] font-bold text-white cursor-pointer"
            onClick={printReport}
          >
            인쇄
          </button>
        </div>
      </section>
    </div>
  );
}
