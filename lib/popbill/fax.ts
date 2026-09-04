import { readPopbillConfig, requirePopbillSender, type PopbillConfig } from "./config";
import { getFaxService } from "./sdk";
import { checkSenderRegistered } from "./senders";
import { PopbillSubmitError, submitWithTimeout } from "./types";

/**
 * Popbill 바이너리 팩스 접수 어댑터 — **서버 전용**.
 *
 * 세대별 단일 PDF를 한 건으로 접수한다. 생성된 buffer는 메모리에서만 전달하고 디스크에 쓰지 않는다.
 * 접수 성공은 발송 성공이 아니며 최종 결과는 재조회로 확정한다.
 */

export interface FaxSubmitInput {
  requestNum: string;
  receiver: string;
  receiverName?: string | null;
  title: string;
  fileName: string;
  pdf: Buffer;
  providerRefKey: string;
}

export interface FaxSubmission {
  requestNum: string;
  receiptNum: string;
}

/** 접수 어댑터 옵션. timeoutMs로 응답 없는 접수의 무한 대기를 막는다(테스트에서 주입 가능). */
export interface FaxSubmitOptions {
  timeoutMs?: number;
}

export async function submitFax(
  input: FaxSubmitInput,
  config: PopbillConfig = readPopbillConfig(),
  options: FaxSubmitOptions = {},
): Promise<FaxSubmission> {
  // 설정 오류(발신번호 미등록)는 타임아웃 이전에 즉시 확정 실패로 거절한다.
  const sender = requirePopbillSender(config, "fax");
  const service = getFaxService(config);
  const receiver = input.receiver.replace(/\D/g, "");
  if (!(await checkSenderRegistered("fax", sender, config))) {
    throw new PopbillSubmitError("SENDER_NOT_REGISTERED", "팩스 발신번호가 등록되어 있지 않습니다.");
  }
  return submitWithTimeout<FaxSubmission>((resolve, reject) => {
    service.sendFaxBinary(
      config.corpNum,
      {
        SenderNum: sender,
        Receiver: receiver,
        ReceiverName: input.receiverName ?? undefined,
        BinaryFiles: [{ fileName: input.fileName, fileData: input.pdf }],
        // SDK가 옵션 객체 형태에서 FilePaths 빈값 검사를 하므로 truthy 값을 전달한다.
        FilePaths: [{ fileName: input.fileName }],
        Title: input.title,
        RequestNum: input.requestNum,
        interOPRefKey: input.providerRefKey,
        UserID: config.userId,
      },
      (receiptNum) => resolve({ requestNum: input.requestNum, receiptNum }),
      (e) => reject(new PopbillSubmitError(String(e?.code ?? "PROVIDER_ERROR"), e?.message ?? "팩스 접수 오류")),
    );
  }, options.timeoutMs);
}
