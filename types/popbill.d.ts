/**
 * 최소 Popbill Node SDK 타입 선언.
 *
 * popbill 패키지는 TypeScript 타입을 제공하지 않는다. 여기에는 이 저장소가 **실제로 호출하는**
 * config·MessageService·KakaoService·FaxService 메서드와 접수/결과 callback만 최소 선언한다.
 * SDK의 나머지 서비스는 선언하지 않는다.
 */
declare module "popbill" {
  /** 접수 성공 callback — 접수번호(receiptNum) 문자열을 받는다. */
  export type PopbillReceiptHandler = (receiptNum: string) => void;
  export interface PopbillError {
    code: number;
    message: string;
  }
  export type PopbillErrorHandler = (error: PopbillError) => void;

  export interface PopbillConfigInput {
    LinkID: string;
    SecretKey: string;
    IsTest?: boolean;
    IPRestrictOnOff?: boolean;
    UseStaticIP?: boolean;
    UseLocalTimeYN?: boolean;
    UseGAIP?: boolean;
    defaultErrorHandler?: PopbillErrorHandler;
  }
  export function config(input: PopbillConfigInput): void;

  /** 문자(SMS/LMS) 일괄 접수용 개별 메시지. SDK가 내부에서 snd/rcv 등으로 매핑한다. */
  export interface PopbillMessageInput {
    Sender?: string;
    SenderName?: string;
    Receiver: string;
    ReceiverName?: string;
    Contents?: string;
    Subject?: string;
    interOPRefKey?: string;
  }

  /** 문자/알림톡 결과 조회 응답의 수신자별 항목. state=3/result=100이 최종 성공. */
  export interface PopbillMessageResult {
    state: number;
    result: number;
    receiveNum?: string;
    interOPRefKey?: string;
    tranNet?: string;
    sendDT?: string;
    resultDT?: string;
  }

  export interface MessageService {
    checkSenderNumber(
      corpNum: string,
      senderNumber: string,
      userId: string,
      success: (result: { code: number; message?: string }) => void,
      error: PopbillErrorHandler,
    ): void;
    sendSMS_multi(
      corpNum: string,
      sender: string,
      contents: string,
      messages: PopbillMessageInput[],
      reserveDT: string | null,
      adsYN: boolean,
      requestNum: string,
      senderName: string,
      userId: string,
      success: PopbillReceiptHandler,
      error: PopbillErrorHandler,
    ): void;
    sendLMS_multi(
      corpNum: string,
      sender: string,
      subject: string,
      contents: string,
      messages: PopbillMessageInput[],
      reserveDT: string | null,
      adsYN: boolean,
      requestNum: string,
      senderName: string,
      userId: string,
      success: PopbillReceiptHandler,
      error: PopbillErrorHandler,
    ): void;
    getMessages(
      corpNum: string,
      receiptNum: string,
      userId: string,
      success: (results: PopbillMessageResult[]) => void,
      error: PopbillErrorHandler,
    ): void;
    getMessagesRN(
      corpNum: string,
      requestNum: string,
      userId: string,
      success: (results: PopbillMessageResult[]) => void,
      error: PopbillErrorHandler,
    ): void;
  }
  export function MessageService(): MessageService;

  export interface PopbillKakaoButton {
    t: string;
    n: string;
    u1?: string;
    u2?: string;
  }
  export interface PopbillKakaoMessageInput {
    rcv: string;
    rcvnm?: string;
    msg?: string;
    altsjt?: string;
    altmsg?: string;
    interOPRefKey?: string;
    btns?: PopbillKakaoButton[];
  }

  export interface KakaoService {
    sendATS_multi(
      corpNum: string,
      templateCode: string,
      sender: string,
      altSendType: string,
      sndDT: string | null,
      msgs: PopbillKakaoMessageInput[],
      userId: string,
      requestNum: string,
      btns: PopbillKakaoButton[] | null,
      success: PopbillReceiptHandler,
      error: PopbillErrorHandler,
    ): void;
    getMessages(
      corpNum: string,
      receiptNum: string,
      userId: string,
      success: (results: PopbillMessageResult[]) => void,
      error: PopbillErrorHandler,
    ): void;
    getMessagesRN(
      corpNum: string,
      requestNum: string,
      userId: string,
      success: (results: PopbillMessageResult[]) => void,
      error: PopbillErrorHandler,
    ): void;
  }
  export function KakaoService(): KakaoService;

  export interface PopbillFaxBinaryFile {
    fileName: string;
    fileData: Buffer;
  }
  export interface PopbillFaxBinaryOptions {
    SenderNum?: string;
    SenderName?: string;
    Receiver: string;
    ReceiverName?: string;
    BinaryFiles: PopbillFaxBinaryFile[];
    /** SDK가 빈 값 검사에 사용한다. BinaryFiles와 동일 배열을 넘겨 통과시킨다. */
    FilePaths?: unknown;
    ReserveDT?: string | null;
    AdsYN?: boolean;
    Title?: string;
    RequestNum?: string;
    interOPRefKey?: string;
    UserID?: string;
  }
  /** 팩스 결과 조회 응답 항목. 페이지 수 필드는 정산·비용 분석에 사용한다. */
  export interface PopbillFaxResult {
    state: number;
    result: number;
    sendPageCnt?: number;
    successPageCnt?: number;
    failPageCnt?: number;
    refundPageCnt?: number;
    cancelPageCnt?: number;
    chargePageCnt?: number;
    receiveNum?: string;
    interOPRefKey?: string;
    sendDT?: string;
    resultDT?: string;
  }
  export interface FaxService {
    checkSenderNumber(
      corpNum: string,
      senderNumber: string,
      userId: string,
      success: (result: { code: number; message?: string }) => void,
      error: PopbillErrorHandler,
    ): void;
    sendFaxBinary(
      corpNum: string,
      options: PopbillFaxBinaryOptions,
      success: PopbillReceiptHandler,
      error: PopbillErrorHandler,
    ): void;
    getFaxResult(
      corpNum: string,
      receiptNum: string,
      userId: string,
      success: (results: PopbillFaxResult[]) => void,
      error: PopbillErrorHandler,
    ): void;
    getFaxResultRN(
      corpNum: string,
      requestNum: string,
      userId: string,
      success: (results: PopbillFaxResult[]) => void,
      error: PopbillErrorHandler,
    ): void;
  }
  export function FaxService(): FaxService;
}
