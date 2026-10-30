export type AcademicDocumentRole = "study_plan" | "transcript";

export type ProcessingDocument = {
  type: string;
  status: string;
};

export type DocumentProcessingSummary = {
  documentCount: number;
  documentNames: string[];
  documentList: string;
  state: "empty" | "awaiting_documents" | "ready_to_process" | "processing" | "retryable" | "complete";
  title: string;
  description: string;
  canStart: boolean;
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
      description: "อัปโหลด Study Plan และ Transcript ให้ครบก่อนเริ่มวิเคราะห์ข้อมูลการเรียน",
      canStart: false,
      canRetry: false,
    };
  }

  if (roles.length < 2) {
    return {
      documentCount: roles.length,
      documentNames,
      documentList,
      state: "awaiting_documents",
      title: "รออัปโหลดเอกสารอีก 1 รายการ",
      description: `อัปโหลด ${roles[0] === "study_plan" ? "Transcript" : "Study Plan"} เพิ่มก่อน แล้วจึงเริ่มวิเคราะห์ ${documentList} พร้อมกัน`,
      canStart: false,
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
      canStart: false,
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
        ? "Typhoon จำกัดจำนวนคำขอชั่วคราว โปรดลองประมวลผลอีกครั้งภายหลัง"
        : `มีเอกสารบางไฟล์อ่านไม่สำเร็จ โปรดลองประมวลผล ${documentList} อีกครั้ง`,
      canStart: false,
      canRetry: true,
    };
  }

  if (documents.some(document => document.status === "uploaded")) {
    return {
      documentCount: roles.length,
      documentNames,
      documentList,
      state: "ready_to_process",
      title: "เอกสารพร้อมวิเคราะห์",
      description: `ระบบจะส่ง ${documentList} ให้ AI พร้อมกันเมื่อคุณกดเริ่มวิเคราะห์`,
      canStart: true,
      canRetry: false,
    };
  }

  return {
    documentCount: roles.length,
    documentNames,
    documentList,
    state: "complete",
    title: "ข้อมูลการเรียนพร้อมตรวจสอบ",
    description: `ระบบประมวลผล ${documentList} แล้ว คุณสามารถไปตรวจสอบข้อมูลก่อนนำไปใช้วางแผนการเรียน`,
    canStart: false,
    canRetry: false,
  };
}
