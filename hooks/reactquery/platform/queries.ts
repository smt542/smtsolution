import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  getPlatformOverview,
  getPlatformOrganizationContractKpis,
  getOrganizationContractFilePreview,
  getPlatformOrganizationOwner,
  listPlatformAccounts,
  listPlatformOrganizations,
  listPointTransactions,
  type PlatformAccountQuery,
  type PlatformOrganizationQuery,
  type PointTransactionCursor,
  type PointTransactionQuery,
} from "./apis";
import {
  listMessagePointRates,
  listPointReservations,
  type PointReservationQuery,
} from "./pointBilling";
import { platformKeys } from "./keys";
import { SIGNED_URL_GC_TIME_MS, SIGNED_URL_STALE_TIME_MS } from "@/lib/attachments/signedUrl";

export function usePlatformOverview() {
  return useQuery({
    queryKey: platformKeys.overview(),
    queryFn: getPlatformOverview,
  });
}

export function usePlatformOrganizations(opts: PlatformOrganizationQuery = {}) {
  return useQuery({
    queryKey: platformKeys.organizations(opts),
    queryFn: () => listPlatformOrganizations(opts),
  });
}

export function usePlatformOrganizationContractKpis() {
  return useQuery({
    queryKey: platformKeys.organizationContractKpis(),
    queryFn: getPlatformOrganizationContractKpis,
  });
}

export function useOrganizationContractFilePreview(path: string | null) {
  return useQuery({
    queryKey: platformKeys.organizationContractFile(path ?? ""),
    queryFn: () => getOrganizationContractFilePreview(path as string),
    enabled: Boolean(path),
    staleTime: SIGNED_URL_STALE_TIME_MS,
    gcTime: SIGNED_URL_GC_TIME_MS,
    retry: 1,
  });
}

export function usePlatformAccounts(opts: PlatformAccountQuery = {}) {
  return useQuery({
    queryKey: platformKeys.accounts(opts),
    queryFn: () => listPlatformAccounts(opts),
  });
}

export function usePlatformTransactions(
  opts: Omit<PointTransactionQuery, "cursor"> = {},
) {
  return useInfiniteQuery({
    queryKey: platformKeys.transactions(opts),
    queryFn: ({ pageParam }) =>
      listPointTransactions({ ...opts, cursor: pageParam }),
    initialPageParam: null as PointTransactionCursor | null,
    getNextPageParam: (lastPage, pages) => {
      const loadedCount = pages.reduce((total, page) => total + page.rows.length, 0);
      return loadedCount < lastPage.totalCount ? lastPage.nextCursor : undefined;
    },
  });
}

export function useMessagePointRates(includeHistory = false) {
  return useQuery({
    queryKey: platformKeys.messagePointRates(includeHistory),
    queryFn: () => listMessagePointRates(includeHistory),
  });
}

export function usePointReservations(opts: PointReservationQuery = {}) {
  return useQuery({
    queryKey: platformKeys.pointReservations(opts),
    queryFn: () => listPointReservations(opts),
  });
}

/** 테넌트 상세 모달의 관리자 아이디(읽기 전용)·비밀번호 변경 대상 */
export function usePlatformOrganizationOwner(orgId: number | null) {
  return useQuery({
    queryKey: platformKeys.organizationOwner(orgId ?? 0),
    queryFn: () => getPlatformOrganizationOwner(orgId as number),
    enabled: orgId != null && orgId > 0,
  });
}
