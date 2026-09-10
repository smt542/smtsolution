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
      <table className="w-full min-w-[900px] table-fixed border-collapse whitespace-nowrap text-[12.5px]">
        <colgroup>
          <col className="w-[68px]" />
          <col className="w-[104px]" />
          <col />
          <col className="w-[52px]" />
          <col className="w-[144px]" />
          <col className="w-[60px]" />
          <col className="w-[60px]" />
          <col className="w-[64px]" />
          <col className="w-[150px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line bg-[#FBFCFD] text-left text-t3">
            <th scope="col" className="min-w-[52px] px-4 py-[11px] text-[12px] font-bold">코드</th>
            <th scope="col" className="min-w-[104px] px-4 py-[11px] text-[12px] font-bold">빌라명</th>
            <th scope="col" className="px-4 py-[11px] text-[12px] font-bold">주소</th>
            <th scope="col" className="min-w-[44px] px-4 py-[11px] text-right text-[12px] font-bold">LIN</th>
            <th scope="col" className="min-w-[120px] px-4 py-[11px] text-[12px] font-bold">{customerNumberHeading}</th>
            <th scope="col" className="min-w-[60px] px-4 py-[11px] text-right text-[12px] font-bold">일금일</th>
            <th scope="col" className="min-w-[60px] px-4 py-[11px] text-[12px] font-bold">구분</th>
            <th scope="col" className="min-w-[64px] px-4 py-[11px] text-[12px] font-bold">계산</th>
            <th scope="col" className="min-w-[150px] px-4 py-[11px] text-[12px] font-bold">기타적요</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="cursor-pointer border-b border-line2 text-[13.5px] text-t1 last:border-0 hover:bg-[#FBFCFD]"
            >
              <td className="num truncate px-4 py-3" title={row.buildingCode}>
                {row.buildingCode}
              </td>
              <td className="truncate px-4 py-3 font-semibold" title={row.buildingName}>
                {row.buildingName}
              </td>
              <td
                className={`truncate px-4 py-3 ${row.address ? "" : "text-t3"}`}
                title={row.address ?? undefined}
              >
                {row.address ?? "-"}
              </td>
              <td className={`num px-4 py-3 text-right ${row.lineName ? "" : "text-t3"}`}>
                {row.lineName ?? "-"}
              </td>
              <td className="num truncate px-4 py-3 font-bold" title={row.customerNo}>
                {row.customerNo}
              </td>
              <td className={`num px-4 py-3 text-right ${row.meterDay ? "" : "text-t3"}`}>
                {row.meterDay ?? "-"}
              </td>
              <td className="px-4 py-3 font-semibold">{BILLING_BASIS_LABELS[row.billingBasis]}</td>
              <td className="px-4 py-3">{CALCULATION_LABELS[row.calculationMethod]}</td>
              <td
                className={`truncate px-4 py-3 ${row.note ? "" : "text-t3"}`}
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
