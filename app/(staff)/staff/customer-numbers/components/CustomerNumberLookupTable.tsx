import type { KeyboardEvent } from "react";
import type {
  CustomerNumberKind,
  CustomerNumberLookupRow,
} from "@/hooks/reactquery/buildingCustomerNumbers";

const KIND_LABELS: Record<CustomerNumberKind, string> = {
  water: "수도",
  common_elec: "공용전기",
  elec: "전기",
  gas: "가스",
};

const BILLING_BASIS_LABELS: Record<CustomerNumberLookupRow["billingBasis"], string> = {
  prev: "전월",
  current: "당월",
};

export function CustomerNumberLookupTable({
  rows,
  onRowClick,
}: {
  rows: CustomerNumberLookupRow[];
  onRowClick: (row: CustomerNumberLookupRow) => void;
}) {
  const openWithKeyboard = (
    event: KeyboardEvent<HTMLTableRowElement>,
    row: CustomerNumberLookupRow,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-line bg-bg/80 text-left text-t2">
            <th scope="col" className="px-5 py-3.5 font-bold">건물명</th>
            <th scope="col" className="px-3 py-3.5 font-bold">유형</th>
            <th scope="col" className="px-3 py-3.5 font-bold">고객번호</th>
            <th scope="col" className="px-3 py-3.5 font-bold">명의자</th>
            <th scope="col" className="px-3 py-3.5 text-center font-bold">검침일</th>
            <th scope="col" className="px-3 py-3.5 text-center font-bold">부과기준</th>
            <th scope="col" className="px-5 py-3.5 text-center font-bold">고지서출력</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              tabIndex={0}
              aria-label={`${row.buildingName} 고객번호 상세 보기`}
              onClick={() => onRowClick(row)}
              onKeyDown={(event) => openWithKeyboard(event, row)}
              className="cursor-pointer border-b border-line2 transition last:border-0 hover:bg-blue-t2 focus:bg-blue-t2 focus:outline-none"
            >
              <td className="px-5 py-4 font-extrabold text-t1">{row.buildingName}</td>
              <td className="px-3 py-4 text-t1">{KIND_LABELS[row.kind]}</td>
              <td className="num px-3 py-4 text-t1">{row.customerNo}</td>
              <td className="px-3 py-4 text-t2">{row.holderName ?? "—"}</td>
              <td className="num px-3 py-4 text-center text-t2">
                {row.meterDay === null ? "—" : `${row.meterDay}일`}
              </td>
              <td className="px-3 py-4 text-center text-t2">
                {BILLING_BASIS_LABELS[row.billingBasis]}
              </td>
              <td className="px-5 py-4 text-center font-bold text-t2">
                {row.printOnBill ? "Y" : "N"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
