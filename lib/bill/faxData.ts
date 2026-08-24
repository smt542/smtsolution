import { buildFaxDocument, type FaxDocumentData, type FaxDocumentRow } from "./document";

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
  return buildFaxDocument(row);
}
