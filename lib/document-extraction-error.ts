import { GeminiRequestError, isGeminiRateLimitError } from "@/lib/gemini";

export type DocumentExtractionErrorCode =
  | "gemini_configuration"
  | "gemini_authentication"
  | "gemini_model"
  | "gemini_rate_limited"
  | "gemini_request"
  | "storage_download"
  | "profile_save"
  | "unknown";

export type ExtractionStage = "storage_download" | "gemini" | "profile_save";

/** Maps untrusted provider/database errors to non-sensitive, user-displayable codes. */
export function documentExtractionErrorCode(error: unknown, stage: ExtractionStage): DocumentExtractionErrorCode {
  if (stage === "storage_download") return "storage_download";
  if (stage === "profile_save") return "profile_save";
  if (isGeminiRateLimitError(error)) return "gemini_rate_limited";
  if (error instanceof GeminiRequestError) {
    if (error.status === 401 || error.status === 403) return "gemini_authentication";
    if (error.status === 404 || error.status === 400) return "gemini_model";
    return "gemini_request";
  }
  if (error instanceof Error && /Gemini is not configured/i.test(error.message)) return "gemini_configuration";
  return "unknown";
}

export function documentExtractionErrorMessage(code: string | null | undefined) {
  const messages: Record<DocumentExtractionErrorCode, string> = {
    gemini_configuration: "ยังไม่ได้ตั้งค่า Gemini บนเซิร์ฟเวอร์",
    gemini_authentication: "Gemini ปฏิเสธ API key หรือสิทธิ์การใช้งาน",
    gemini_model: "ชื่อหรือการตั้งค่าโมเดล Gemini ไม่ถูกต้อง",
    gemini_rate_limited: "โควตา Gemini หมดชั่วคราว",
    gemini_request: "Gemini ไม่สามารถประมวลผลคำขอนี้ได้",
    storage_download: "เซิร์ฟเวอร์ดาวน์โหลดไฟล์จากพื้นที่เก็บข้อมูลไม่ได้",
    profile_save: "อ่านเอกสารได้ แต่บันทึกผลลงฐานข้อมูลไม่ได้",
    unknown: "งานอ่านเอกสารล้มเหลวโดยไม่ทราบสาเหตุ",
  };
  return messages[code as DocumentExtractionErrorCode] || messages.unknown;
}
