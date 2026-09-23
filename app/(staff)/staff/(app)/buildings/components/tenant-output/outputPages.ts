import type { Building } from "@/hooks/reactquery/buildings";
import type { OutputQueryStatus, TenantOutputBuildingData } from "@/hooks/reactquery/tenantOutput";
import { buildCardSheetPages, type CardOrgInfo, type CardSheetPage } from "./cardSheet";
import { buildStatementSheetPages, type StatementSheetPage } from "./statementSheet";

export interface BuildingOutputPages {
  building: Building;
  cards: CardSheetPage[];
  statements: StatementSheetPage[];
}

export interface OutputPages {
  /** 미리보기용 — 선택 건물(목록 순서)의 입주자카드 쪽을 이어 붙인 배열. */
  cards: CardSheetPage[];
  statements: StatementSheetPage[];
  cardStatus: OutputQueryStatus;
  statementStatus: OutputQueryStatus;
  /** 인쇄용 — 건물별 묶음. */
  byBuilding: BuildingOutputPages[];
}

/** 하나라도 로딩이면 로딩, 실패가 있으면 실패, 아니면 준비. */
export function mergeStatus(statuses: OutputQueryStatus[]): OutputQueryStatus {
  if (statuses.includes("loading")) return "loading";
  if (statuses.includes("error")) return "error";
  return "ready";
}

/** 선택 건물(목록 순서)과 건물별 조회 결과를 미리보기·인쇄용 쪽으로 펼친다. 조회가 끝난 건물만 쪽을 만든다. */
export function buildOutputPages(selected: Building[], data: TenantOutputBuildingData[], org: CardOrgInfo): OutputPages {
  const dataById = new Map(data.map((entry) => [entry.buildingId, entry]));
  const byBuilding = selected.map((building): BuildingOutputPages => {
    const entry = dataById.get(building.id);
    const cards =
      entry?.cardStatus === "ready" ? buildCardSheetPages(building, entry.buildingFull, entry.cardRows, org) : [];
    const statements =
      entry?.statementStatus === "ready"
        ? buildStatementSheetPages(building, entry.documents, entry.feeItems, entry.elecRows, entry.waterRows)
        : [];
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
export type PrintItem = { kind: "card"; page: CardSheetPage } | { kind: "statement"; page: StatementSheetPage };

/** 인쇄 순서(PDF): 둘 다 = 건물별 [카드 → 내역서], 카드만·내역서만 = 그 문서만 건물 순서대로. */
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
