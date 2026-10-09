import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  approveResidentClaim,
  rejectResidentClaim,
  residentConfirm,
  residentRequestClaim,
  stubResidentKakaoLogin,
} from "./apis";
import type { ResidentStubLoginInput } from "./apis";
import { residentClaimKeys } from "./keys";
import { sendMessages } from "../messaging/apis";
import { newUuid } from "@/lib/messaging/idempotencyKey";

export function useStubResidentKakaoLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResidentStubLoginInput = {}) => stubResidentKakaoLogin(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: residentClaimKeys.all }),
  });
}

export function useResidentConfirm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (occupancyId: number) => residentConfirm(occupancyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: residentClaimKeys.all }),
  });
}

export function useResidentRequestClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { buildingId: number; unitText: string }) => residentRequestClaim(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: residentClaimKeys.all }),
  });
}

export function useApproveResidentClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { claimId: number; occupancyId: number }) => approveResidentClaim(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: residentClaimKeys.all }),
  });
}

export function useRejectResidentClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (claimId: number) => rejectResidentClaim(claimId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: residentClaimKeys.all }),
  });
}

export interface ClaimLinkedNoticeInput {
  claimedName: string | null;
  phone: string | null;
  buildingName: string;
  unitNo: string;
}

/**
 * 세대 연결 승인 후 요청자에게 「세대 연결 완료」 안내를 보낸다(공용 발송 경로 /api/messaging/send).
 * 승인된 알림톡 템플릿이 없어 문자(SMS)로 보내며, 포인트는 발송 경로의 예약·차감 정책을 그대로 따른다.
 * 호출부는 실패해도 승인을 되돌리지 않는다(비차단 경고만 표시).
 */
export function useNotifyClaimLinked() {
  return useMutation({
    mutationFn: async (input: ClaimLinkedNoticeInput) => {
      const phone = input.phone?.replace(/\D/g, "") ?? "";
      if (!phone) return null;
      const body = `[관리사무소] ${input.buildingName} ${input.unitNo}호 세대 연결이 완료되었습니다. 앱에서 고지서와 공지를 확인하실 수 있어요.`;
      // kind "etc": 서비스 처리 결과 안내라 세대 문자 수신 동의(sms_opt_in) 라우팅 대상이 아니다.
      return sendMessages({
        mode: "sms",
        body,
        context: "세대 연결 승인",
        templateId: null,
        scheduledAt: null,
        idempotencyKey: newUuid(),
        recipients: [
          {
            name: input.claimedName,
            phone,
            kind: "etc",
            channel: "sms",
            renderedBody: body,
          },
        ],
      });
    },
  });
}
