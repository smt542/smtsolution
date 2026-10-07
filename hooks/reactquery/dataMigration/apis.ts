import { createClient } from "@/lib/supabase/client";

/** 셋업 > 데이터 이관 대상(정책서 data-kind 8종). */
export type MigrationKind =
  | "vendorMaster"
  | "building"
  | "vendor"
  | "util"
  | "feeitem"
  | "tenant"
  | "meter"
  | "unpaid";

/** 대상별 가장 최근 이관 실행 기록. */
export interface MigrationRun {
  kind: MigrationKind;
  totalCount: number;
  okCount: number;
  failCount: number;
  createdAt: string;
}

export interface MigrationRowInput {
  /** CSV 행 번호(헤더=1행). 실패 안내에 그대로 쓴다. */
  line: number;
  /** 열 이름(한국어 헤더) → 값. */
  rec: Record<string, string>;
}

export interface MigrationFailure {
  line: number | null;
  message: string;
}

export interface MigrationImportResult {
  total: number;
  ok: number;
  failed: number;
  failures: MigrationFailure[];
}

/** 한 번에 서버로 보내는 최대 행 수(서버 제한 1000행보다 작게). */
const CHUNK_SIZE = 500;

export async function listMigrationRuns(): Promise<MigrationRun[]> {
  const { data, error } = await createClient()
    .from("data_migration_runs")
    .select("kind,total_count,ok_count,fail_count,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const latest = new Map<MigrationKind, MigrationRun>();
  for (const row of data ?? []) {
    const kind = row.kind as MigrationKind;
    if (latest.has(kind)) continue;
    latest.set(kind, {
      kind,
      totalCount: row.total_count,
      okCount: row.ok_count,
      failCount: row.fail_count,
      createdAt: row.created_at,
    });
  }
  return [...latest.values()];
}

/**
 * 검증을 통과한 행을 서버에 등록한다. 행마다 성공·실패가 따로 처리되며(한 행 실패가 다른 행에
 * 영향 없음), 큰 파일은 CHUNK_SIZE 단위로 나눠 보낸다. 요청 자체가 실패하면 그때까지의 결과와
 * 함께 오류를 던진다(MigrationRequestError).
 */
export async function importMigrationRows(
  kind: MigrationKind,
  rows: MigrationRowInput[],
): Promise<MigrationImportResult> {
  const total: MigrationImportResult = { total: 0, ok: 0, failed: 0, failures: [] };
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    const chunk = rows.slice(start, start + CHUNK_SIZE);
    const { data, error } = await createClient().rpc("import_migration_rows", {
      p_kind: kind,
      p_rows: chunk,
    });
    if (error) {
      throw new MigrationRequestError(error.message, total, rows.length - start);
    }
    const result = data as {
      total: number;
      ok: number;
      failed: number;
      failures: { line: number | null; message: string }[];
    };
    total.total += result.total;
    total.ok += result.ok;
    total.failed += result.failed;
    total.failures.push(...(result.failures ?? []));
  }
  return total;
}

/** 서버 요청 자체가 실패함(권한·네트워크 등). partial = 실패 전까지 처리된 결과. */
export class MigrationRequestError extends Error {
  constructor(
    message: string,
    readonly partial: MigrationImportResult,
    readonly unsentCount: number,
  ) {
    super(message);
    this.name = "MigrationRequestError";
  }
}

export async function resetMigrationRuns(): Promise<void> {
  const { error } = await createClient().rpc("reset_migration_runs");
  if (error) throw new Error(error.message);
}
