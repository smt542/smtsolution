import type { PopbillError } from "popbill";
import { readPopbillConfig, type PopbillConfig } from "./config";
import { getFaxService, getMessageService } from "./sdk";
import { submitWithTimeout } from "./types";

export type SenderProduct = "sms" | "fax";

/** Popbill 계정에 발신번호가 등록되어 있는지 안전하게 확인한다. */
export async function checkSenderRegistered(
  product: SenderProduct,
  number: string,
  config?: PopbillConfig,
): Promise<boolean> {
  const senderNumber = number.replace(/\D/g, "");
  if (!senderNumber) return false;

  try {
    const effectiveConfig = config ?? readPopbillConfig();
    const service =
      product === "sms" ? getMessageService(effectiveConfig) : getFaxService(effectiveConfig);
    const result = await submitWithTimeout<{ code: number; message?: string }>((resolve, reject) => {
      service.checkSenderNumber(
        effectiveConfig.corpNum,
        senderNumber,
        effectiveConfig.userId ?? "",
        resolve,
        (error: PopbillError) => reject(error),
      );
    });
    return result.code === 1;
  } catch {
    return false;
  }
}
