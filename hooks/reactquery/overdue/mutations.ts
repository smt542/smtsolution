import { useMutation } from "@tanstack/react-query";

export interface OverdueMessageRecipient {
  occupancyId: number;
  unitNo: string;
  tenantName?: string | null;
  phone?: string | null;
}

export interface OverdueMessageDraft {
  status: "unavailable";
  template: "overdue-reminder";
  recipients: OverdueMessageRecipient[];
}

export function prepareOverdueMessage(
  recipients: OverdueMessageRecipient[],
): OverdueMessageDraft {
  if (recipients.length === 0) {
    throw new Error("문자를 받을 세대를 선택해 주세요.");
  }

  // TODO(messaging): 공용 발송 모듈이 구현되면 수신처와 독촉 프리셋을 전달한다.
  // 지금은 네트워크 요청이나 실제 발송을 하지 않는 안전한 준비 화면만 제공한다.
  return {
    status: "unavailable",
    template: "overdue-reminder",
    recipients,
  };
}

export function usePrepareOverdueMessage() {
  return useMutation({
    mutationFn: async (recipients: OverdueMessageRecipient[]) =>
      prepareOverdueMessage(recipients),
  });
}
