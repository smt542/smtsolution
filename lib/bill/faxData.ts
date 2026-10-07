import { buildFaxDocument, publicBillUrl, type FaxDocumentData, type FaxDocumentRow } from "./document";

/**
 * 팩스 문서 서버 데이터 로더 — **서버 전용**.
 *
 * load_fax_document RPC(조직 소유·bill_publish 검증, 확정 관리비/조직 설정 기반)를 호출해
 * 클라이언트가 보낸 금액/계좌/이름을 신뢰하지 않는 권위 데이터를 반환한다.
 */

interface RpcResult {
  data: unknown;
  error: { message: string } | null;
}
export interface SupabaseRpcLike {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<RpcResult>;
}

export class FaxDocumentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "FaxDocumentError";
  }
}

export async function loadFaxDocumentData(
  sb: SupabaseRpcLike,
  billIssueId: number,
): Promise<FaxDocumentData> {
  const { data, error } = await sb.rpc("load_fax_document", { p_bill_issue_id: billIssueId });
  if (error) throw new FaxDocumentError("LOAD_FAILED", error.message);
  const row = data as ({ ok?: boolean; code?: string } & FaxDocumentRow) | null;
  if (!row?.ok) {
    throw new FaxDocumentError(row?.code ?? "BILL_ISSUE_NOT_FOUND", "고지서 정보를 찾지 못했습니다.");
  }
  const doc = buildFaxDocument(row);
  return { ...doc, qrPayload: await signedBillUrl(sb, doc.unitId, doc.period) };
}

/**
 * 고지서 QR용 공개 고지서 URL(staff_sign_bill_urls 서명, 발급일 기준 30일 유효).
 * 서명을 발급하지 못하면(부과 미확정·권한 없음 등) 빈 문자열을 돌려 QR을 생략한다 — 팩스 발송은 막지 않는다.
 */
async function signedBillUrl(sb: SupabaseRpcLike, unitId: number, period: string): Promise<string> {
  const { data, error } = await sb.rpc("staff_sign_bill_urls", { p_unit_ids: [unitId], p_period: period });
  if (error) return "";
  const link = ((data ?? []) as Array<{ building_id: number; unit_no: string; sig: string; issued_day: number | null }>)[0];
  return link
    ? publicBillUrl({ buildingId: link.building_id, unitNo: link.unit_no, period, sig: link.sig, issuedDay: link.issued_day })
    : "";
}
