import { Badge, Button, EmptyState, Spinner } from "@/components/common";
import type { PaymentKind, PaymentRow } from "@/hooks/reactquery/payments";
import { PAY_STATUS_LABEL, PAY_STATUS_STYLE } from "./constants";

type PaymentAction = PaymentKind | "cancel" | "giro";

interface PaymentTableProps {
  rows: PaymentRow[];
  isLoading: boolean;
  onAction: (row: PaymentRow, action: PaymentAction) => void;
  onStatement: (row: PaymentRow) => void;
}

function formatAmount(amount: number | null) {
  return amount == null ? "-" : amount.toLocaleString();
}

function formatUnit(row: PaymentRow) {
  return row.dong ? `${row.dong} ${row.unitNo}` : row.unitNo;
}

export function PaymentTable({ rows, isLoading, onAction, onStatement }: PaymentTableProps) {
  if (isLoading) return <Spinner />;
  if (rows.length === 0) {
    return <EmptyState message="조건에 맞는 수납 내역이 없습니다" />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[1280px] text-sm">
        <thead>
          <tr className="border-b border-line bg-bg text-left text-xs font-bold text-t3">
            <th className="px-4 py-3">호실</th>
            <th className="px-4 py-3">입주자</th>
            <th className="px-4 py-3 text-right">부과금액</th>
            <th className="px-4 py-3 text-right">수납금액</th>
            <th className="px-4 py-3 text-right">미납금액</th>
            <th className="px-4 py-3">납기일</th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">처리</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const unbilled = row.payStatus === "unbilled";
            const paid = row.payStatus === "paid";

            return (
              <tr key={row.unitId} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-4 font-bold text-t1">
                  {formatUnit(row)}
                </td>
                <td className="px-4 py-4 text-t2">
                  {row.isVacant ? (
                    <span className="text-t4">공실</span>
                  ) : (
                    row.tenantName ?? "-"
                  )}
                </td>
                <td className="num whitespace-nowrap px-4 py-4 text-right text-t2">
                  {formatAmount(row.charged)}
                </td>
                <td className="num whitespace-nowrap px-4 py-4 text-right text-t2">
                  {formatAmount(row.paid)}
                </td>
                <td className="num whitespace-nowrap px-4 py-4 text-right font-bold text-t1">
                  {formatAmount(row.unpaid)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-t2">
                  {row.dueDate ?? "-"}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      className={`inline-flex px-2.5 py-1 ${PAY_STATUS_STYLE[row.payStatus]}`}
                    >
                      {PAY_STATUS_LABEL[row.payStatus]}
                    </Badge>
                    {row.isAutoDebit && (
                      <Badge className="inline-flex bg-blue-t px-2.5 py-1 text-blue">
                        자동이체
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      className="h-9 px-3 text-xs"
                      disabled={paid || unbilled}
                      onClick={() => onAction(row, "full")}
                    >
                      수납
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-3 text-xs"
                      disabled={paid || unbilled}
                      onClick={() => onAction(row, "principal")}
                    >
                      원금
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-3 text-xs"
                      disabled={unbilled}
                      onClick={() => onAction(row, "partial")}
                    >
                      분할
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-3 text-xs"
                      disabled={paid || unbilled}
                      onClick={() => onAction(row, "giro")}
                    >
                      지로
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-3 text-xs"
                      onClick={() => onStatement(row)}
                    >
                      명세서
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 px-3 text-xs"
                      onClick={() => onAction(row, "cancel")}
                    >
                      이력
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
