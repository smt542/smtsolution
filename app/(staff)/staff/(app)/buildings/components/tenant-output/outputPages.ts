import type { OutputQueryStatus, TenantOutputBuildingData } from "@/hooks/reactquery/bill";
import type { Building } from "@/hooks/reactquery/buildings";
import type { TenantCardRow } from "@/hooks/reactquery/occupancies";
import { buildChargeStatement, paginate, type StatementRow } from "./statement";

/** 부과내역서 한 장에 싣는 세대 수(현재 문서 모델 — 2단계 양식에서 바뀔 수 있다). */
export const UNITS_PER_STATEMENT_PAGE = 14;

export interface CardPage {
  key: string;
  building: Building;
  tenant: TenantCardRow;
  /** 건물 안에서의 쪽 번호(0부터) — 문서 하단 쪽 표기용. */
  pageIndex: number;
  pageCount: number;
}

export interface StatementPage {
  key: string;
  building: Building;
  feeNames: string[];
  rows: StatementRow[];
  /** 그 건물의 마지막 장에만 합계를 싣는다. */
  totals?: number[];
  grandTotal?: number;
  pageIndex: number;
  pageCount: number;
}

export interface BuildingOutputPages {
  building: Building;
  cards: CardPage[];
  statements: StatementPage[];
}

export interface OutputPages {
  /** 미리보기용 — 선택 건물(목록 순서)의 입주자카드를 이어 붙인 배열. */
  cards: CardPage[];
  statements: StatementPage[];
  cardStatus: OutputQueryStatus;
  statementStatus: OutputQueryStatus;
  /** 인쇄용 — 건물별 묶음. */
  byBuilding: BuildingOutputPages[];
}

/** 하나라도 로딩이면 로딩, 실패가 있으면 실패, 아니면 준비(스펙 §5). */
export function mergeStatus(statuses: OutputQueryStatus[]): OutputQueryStatus {
  if (statuses.includes("loading")) return "loading";
  if (statuses.includes("error")) return "error";
  return "ready";
}

/** 선택 건물(목록 순서)과 건물별 조회 결과를 미리보기·인쇄용 페이지로 펼친다. */
export function buildOutputPages(selected: Building[], data: TenantOutputBuildingData[]): OutputPages {
  const dataById = new Map(data.map((entry) => [entry.buildingId, entry]));
  const byBuilding = selected.map((building): BuildingOutputPages => {
    const entry = dataById.get(building.id);
    const tenants = entry?.tenants ?? [];
    const cards = tenants.map((tenant, index) => ({
      key: `card-${building.id}-${tenant.unitId}`,
      building,
      tenant,
      pageIndex: index,
      pageCount: tenants.length,
    }));
    const statement = buildChargeStatement(entry?.documents ?? []);
    const chunks = paginate(statement.rows, UNITS_PER_STATEMENT_PAGE);
    const statements = chunks.map((rows, index) => {
      const last = index === chunks.length - 1;
      return {
        key: `statement-${building.id}-${index}`,
        building,
        feeNames: statement.feeNames,
        rows,
        totals: last ? statement.totals : undefined,
        grandTotal: last ? statement.grandTotal : undefined,
        pageIndex: index,
        pageCount: chunks.length,
      };
    });
    return { building, cards, statements };
  });
  return {
    cards: byBuilding.flatMap((entry) => entry.cards),
    statements: byBuilding.flatMap((entry) => entry.statements),
    cardStatus: mergeStatus(data.map((entry) => entry.cardStatus)),
    statementStatus: mergeStatus(data.map((entry) => entry.statementStatus)),
    byBuilding,
  };
}

export type PrintScope = "both" | "card" | "statement";
export type PrintItem = { kind: "card"; page: CardPage } | { kind: "statement"; page: StatementPage };

/** 인쇄 순서(스펙 §6·PDF): 둘 다 = 건물별 [카드 → 내역서], 카드만·내역서만 = 그 문서만 건물 순서대로. */
export function printSequence(scope: PrintScope, pages: OutputPages): PrintItem[] {
  return pages.byBuilding.flatMap((entry) => [
    ...(scope === "statement" ? [] : entry.cards.map((page) => ({ kind: "card" as const, page }))),
    ...(scope === "card" ? [] : entry.statements.map((page) => ({ kind: "statement" as const, page }))),
  ]);
}

/** 정본 `pmHint` 문구. */
export function outputHint(selected: Building[], cardCount: number, statementCount: number): string {
  if (selected.length === 0) return "건물을 선택해 주세요";
  const who = selected.length > 1 ? `${selected.length}곳 선택됨` : `${selected[0].name} 선택됨`;
  return `${who} · 카드 ${cardCount}장 · 내역서 ${statementCount}장`;
}
