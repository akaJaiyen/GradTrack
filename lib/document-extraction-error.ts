export type DocumentExtractionErrorCode =
  | "gemini_configuration"
  | "gemini_authentication"
  | "gemini_model"
  | "gemini_rate_limited"
  | "gemini_request"
  | "typhoon_configuration"
  | "typhoon_authentication"
  | "typhoon_rate_limited"
  | "typhoon_ocr"
  | "typhoon_text"
  | "storage_download"
  | "profile_save"
  | "unknown";

export type ExtractionStage = "storage_download" | "typhoon_ocr" | "typhoon_text" | "profile_save";

function isTyphoonRequestError(error: unknown): error is { status: number; stage: "typhoon_ocr" | "typhoon_text" } {
  return Boolean(error && typeof error === "object" && "status" in error && typeof error.status === "number" && "stage" in error && (error.stage === "typhoon_ocr" || error.stage === "typhoon_text"));
}

/** Maps untrusted provider/database errors to non-sensitive, user-displayable codes. */
export function documentExtractionErrorCode(error: unknown, stage: ExtractionStage): DocumentExtractionErrorCode {
  if (stage === "storage_download") return "storage_download";
  if (stage === "profile_save") return "profile_save";
  if (isTyphoonRequestError(error)) {
    if (error.status === 0) return "typhoon_configuration";
    if (error.status === 429) return "typhoon_rate_limited";
    if (error.status === 401 || error.status === 403) return "typhoon_authentication";
    return error.stage === "typhoon_ocr" ? "typhoon_ocr" : "typhoon_text";
  }
  if (stage === "typhoon_ocr") return "typhoon_ocr";
  if (stage === "typhoon_text") return "typhoon_text";
  return "unknown";
}

export function documentExtractionErrorMessage(code: string | null | undefined) {
  const messages: Record<DocumentExtractionErrorCode, string> = {
    gemini_configuration: "ไม่ได้ตั้งค่า Gemini API key บนเซิร์ฟเวอร์ (ข้อมูลจากงานเดิม)",
    gemini_authentication: "Gemini ปฏิเสธ API key หรือสิทธิ์การใช้งาน (ข้อมูลจากงานเดิม)",
    gemini_model: "โมเดล Gemini ใช้งานไม่ได้ (ข้อมูลจากงานเดิม)",
    gemini_rate_limited: "เกินโควตา Gemini ชั่วคราว (ข้อมูลจากงานเดิม)",
    gemini_request: "Gemini ประมวลผลเอกสารไม่สำเร็จ (ข้อมูลจากงานเดิม)",
    typhoon_configuration: "ยังไม่ได้ตั้งค่า Typhoon API key บนเซิร์ฟเวอร์",
    typhoon_authentication: "Typhoon ปฏิเสธ API key หรือสิทธิ์การใช้งาน",
    typhoon_rate_limited: "เกินโควตาการเรียก Typhoon ชั่วคราว",
    typhoon_ocr: "Typhoon OCR อ่านเอกสารไม่สำเร็จ",
    typhoon_text: "Typhoon สกัดข้อมูลการเรียนจากข้อความ OCR ไม่สำเร็จ",
    storage_download: "เซิร์ฟเวอร์ดาวน์โหลดไฟล์จากพื้นที่เก็บข้อมูลไม่ได้",
    profile_save: "อ่านเอกสารได้ แต่บันทึกผลลงฐานข้อมูลไม่ได้",
    unknown: "งานอ่านเอกสารล้มเหลวโดยไม่ทราบสาเหตุ",
  };
  return messages[code as DocumentExtractionErrorCode] || messages.unknown;
}
