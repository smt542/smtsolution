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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] table-fixed text-[13px]">
        <thead>
          <tr className="h-11 border-b border-line bg-bg/80 text-left text-t2">
            <th scope="col" className="w-[84px] px-3 font-bold">코드</th>
            <th scope="col" className="w-[130px] px-3 font-bold">빌라명</th>
            <th scope="col" className="w-[220px] px-3 font-bold">주소</th>
            <th scope="col" className="w-[70px] px-3 text-center font-bold">LIN</th>
            <th scope="col" className="w-[170px] px-3 font-bold">{customerNumberHeading}</th>
            <th scope="col" className="w-[72px] px-3 text-center font-bold">일금일</th>
            <th scope="col" className="w-[72px] px-3 text-center font-bold">구분</th>
            <th scope="col" className="w-[76px] px-3 text-center font-bold">계산</th>
            <th scope="col" className="px-3 font-bold">기타적요</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="h-[52px] border-b border-line2 last:border-0 hover:bg-bg/50">
              <td className="num truncate px-3 text-t3" title={row.buildingCode}>{row.buildingCode}</td>
              <td className="truncate px-3 font-bold text-t1" title={row.buildingName}>{row.buildingName}</td>
              <td className="truncate px-3 text-t2" title={row.address ?? ""}>{row.address ?? "-"}</td>
              <td className="num px-3 text-center text-t2">{row.lineName ?? "-"}</td>
              <td className="num truncate px-3 font-semibold text-t1" title={row.customerNo}>{row.customerNo}</td>
              <td className="num px-3 text-center text-t2">{row.meterDay ?? "-"}</td>
              <td className="px-3 text-center text-t2">{BILLING_BASIS_LABELS[row.billingBasis]}</td>
              <td className="px-3 text-center">
                <span
                  className={`inline-flex min-w-[42px] justify-center rounded-full px-2 py-1 text-xs font-bold ${
                    row.calculationMethod === "auto"
                      ? "bg-teal-t text-teal"
                      : "bg-amber-t text-amber"
                  }`}
                >
                  {CALCULATION_LABELS[row.calculationMethod]}
                </span>
              </td>
              <td className="truncate px-3 text-t2" title={row.note ?? ""}>{row.note ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
