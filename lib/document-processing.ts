export type AcademicDocumentRole = "study_plan" | "transcript";

export type ProcessingDocument = {
  type: string;
  status: string;
};

export type DocumentProcessingSummary = {
  documentCount: number;
  documentNames: string[];
  documentList: string;
  state: "empty" | "processing" | "retryable" | "complete";
  title: string;
  description: string;
  canRetry: boolean;
};

const documentTitles: Record<AcademicDocumentRole, string> = {
  study_plan: "Study Plan",
  transcript: "Transcript",
};

function joinDocumentNames(names: string[]) {
  if (names.length <= 1) return names[0] || "";
  return names.join(" และ ");
}

/**
 * The extraction endpoint reads every uploaded academic document as one
 * processing run. Keep this summary separate from the per-file status shown
 * beside each upload control so the UI communicates that shared scope.
 */
export function summarizeAcademicDocumentProcessing(
  documents: ProcessingDocument[],
  processing = false,
): DocumentProcessingSummary {
  const roles = documents
    .filter((document): document is ProcessingDocument & { type: AcademicDocumentRole } => document.type === "study_plan" || document.type === "transcript")
    .map(document => document.type);
  const documentNames = roles.map(role => documentTitles[role]);
  const documentList = joinDocumentNames(documentNames);

  if (!roles.length) {
    return {
      documentCount: 0,
      documentNames,
      documentList,
      state: "empty",
      title: "ยังไม่มีเอกสารสำหรับประมวลผล",
      description: "อัปโหลด Study Plan หรือ Transcript เพื่อเริ่มสร้างข้อมูลการเรียน",
      canRetry: false,
    };
  }

  if (processing || documents.some(document => document.status === "extracting")) {
    return {
      documentCount: roles.length,
      documentNames,
      documentList,
      state: "processing",
      title: "กำลังประมวลผลข้อมูลการเรียน",
      description: `AI กำลังอ่านและรวมข้อมูลจาก ${documentList} คุณสามารถออกจากหน้านี้หรือทำงานส่วนอื่นต่อได้`,
      canRetry: false,
    };
  }

  const hasRateLimit = documents.some(document => document.status === "rate_limited");
  const hasFailure = documents.some(document => document.status === "failed");
  if (hasRateLimit || hasFailure) {
    return {
      documentCount: roles.length,
      documentNames,
      documentList,
      state: "retryable",
      title: hasRateLimit ? "การประมวลผลหยุดชั่วคราว" : "ประมวลผลข้อมูลการเรียนไม่สำเร็จ",
      description: hasRateLimit
        ? "โควตา Gemini หมดชั่วคราว โปรดลองอีกครั้งหลัง quota รีเซ็ตหรือเปิด billing"
        : `มีเอกสารบางไฟล์อ่านไม่สำเร็จ โปรดลองประมวลผล ${documentList} อีกครั้ง`,
      canRetry: true,
    };
  }

  return {
    documentCount: roles.length,
    documentNames,
    documentList,
    state: "complete",
    title: "ข้อมูลการเรียนพร้อมตรวจสอบ",
    description: `ระบบประมวลผล ${documentList} แล้ว คุณสามารถไปตรวจสอบข้อมูลก่อนนำไปใช้วางแผนการเรียน`,
    canRetry: false,
  };
}
