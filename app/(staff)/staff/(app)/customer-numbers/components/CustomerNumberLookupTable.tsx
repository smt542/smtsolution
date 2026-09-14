import type {
  CustomerNumberLookupKind,
  CustomerNumberLookupRow,
} from "@/hooks/reactquery/buildingCustomerNumbers";

const BILLING_BASIS_LABELS: Record<CustomerNumberLookupRow["billingBasis"], string> = {
  prev: "전월",
  current: "당월",
};

const CALCULATION_LABELS: Record<CustomerNumberLookupRow["calculationMethod"], string> = {
  auto: "자동",
  manual: "수동",
};

export function CustomerNumberLookupTable({
  rows,
  kind,
}: {
  rows: CustomerNumberLookupRow[];
  kind: CustomerNumberLookupKind;
}) {
  const customerNumberHeading = kind === "water" ? "수도고객번호" : "공용전기고객번호";

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[1000px] table-fixed border-collapse whitespace-nowrap text-[12.5px]">
        <colgroup>
          <col className="w-[7%]" />
          <col className="w-[14%]" />
          <col className="w-[21%]" />
          <col className="w-[6%]" />
          <col className="w-[16%]" />
          <col className="w-[7%]" />
          <col className="w-[7%]" />
          <col className="w-[7%]" />
          <col className="w-[15%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line bg-[#FBFCFD] text-left text-t3">
            <th scope="col" className="h-[36.5px] px-4 py-[11px] text-[12px] font-bold">코드</th>
            <th scope="col" className="h-[36.5px] px-4 py-[11px] text-[12px] font-bold">빌라명</th>
            <th scope="col" className="h-[36.5px] px-4 py-[11px] text-[12px] font-bold">주소</th>
            <th scope="col" className="h-[36.5px] px-4 py-[11px] text-right text-[12px] font-bold">LIN</th>
            <th scope="col" className="h-[36.5px] px-4 py-[11px] text-[12px] font-bold">{customerNumberHeading}</th>
            <th scope="col" className="h-[36.5px] px-4 py-[11px] text-right text-[12px] font-bold">일금일</th>
            <th scope="col" className="h-[36.5px] px-4 py-[11px] text-[12px] font-bold">구분</th>
            <th scope="col" className="h-[36.5px] px-4 py-[11px] text-[12px] font-bold">계산</th>
            <th scope="col" className="h-[36.5px] px-4 py-[11px] text-[12px] font-bold">기타적요</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="cursor-pointer border-b border-line2 text-[13.5px] text-t1 last:border-0 hover:bg-[#FBFCFD]"
            >
              <td className="num h-[41px] truncate px-4 py-[12px]" title={row.buildingCode}>
                {row.buildingCode}
              </td>
              <td className="h-[41px] truncate px-4 py-[12px] font-semibold" title={row.buildingName}>
                {row.buildingName}
              </td>
              <td
                className={`h-[41px] truncate px-4 py-[12px] ${row.address ? "" : "text-t3"}`}
                title={row.address ?? undefined}
              >
                {row.address ?? "-"}
              </td>
              <td className={`num h-[41px] px-4 py-[12px] text-right ${row.lineName ? "" : "text-t3"}`}>
                {row.lineName ?? "-"}
              </td>
              <td className="num h-[41px] truncate px-4 py-[12px] font-bold" title={row.customerNo}>
                {row.customerNo}
              </td>
              <td className={`num h-[41px] px-4 py-[12px] text-right ${row.meterDay ? "" : "text-t3"}`}>
                {row.meterDay ?? "-"}
              </td>
              <td className="h-[41px] px-4 py-[12px] font-semibold">{BILLING_BASIS_LABELS[row.billingBasis]}</td>
              <td className="h-[41px] px-4 py-[12px]">{CALCULATION_LABELS[row.calculationMethod]}</td>
              <td
                className={`h-[41px] truncate px-4 py-[12px] ${row.note ? "" : "text-t3"}`}
                title={row.note ?? undefined}
              >
                {row.note ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
