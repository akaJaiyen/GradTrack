"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import { extractLocally } from "@/lib/client-ocr";
import { documentExtractionErrorMessage } from "@/lib/document-extraction-error";
import { summarizeAcademicDocumentProcessing } from "@/lib/document-processing";
import {
  api,
  documentStatusLabels,
  type Doc,
} from "./shared";

export function DocumentsPage({
  docs,
  reload,
  notice,
}: {
  docs: Doc[];
  reload: () => Promise<void>;
  notice: (message: string) => void;
}) {
  type UploadRole = "study_plan" | "transcript";
  const [busyRoles, setBusyRoles] = useState<Set<UploadRole>>(() => new Set());
  const [processingRoles, setProcessingRoles] = useState<Set<UploadRole>>(() => new Set());
  const [retrying, setRetrying] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Partial<Record<UploadRole, Doc>>>({});
  const studyPlan = uploadedDocs.study_plan || docs.find(doc => doc.type === "study_plan");
  const transcript = uploadedDocs.transcript || docs.find(doc => doc.type === "transcript");
  const isExtracting = studyPlan?.status === "extracting" || transcript?.status === "extracting";
  const isProcessing = busyRoles.size > 0 || processingRoles.size > 0 || retrying || isExtracting;
  const processingSummary = summarizeAcademicDocumentProcessing(
    [studyPlan, transcript].filter((document): document is Doc => Boolean(document)),
    isProcessing,
  );
  useEffect(() => {
    if (!isExtracting) return;
    const timer = window.setTimeout(() => void reload(), 15_000);
    return () => window.clearTimeout(timer);
  }, [isExtracting, reload]);
  const upload = async (role: "study_plan" | "transcript", files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    let uploadStored = false;
    setBusyRoles(current => new Set(current).add(role));
    setProcessingRoles(current => { const next = new Set(current); next.delete(role); return next; });
    try {
      const prepared = await api("/api/documents", "POST", { type: role, fileName: file.name, mimeType: file.type, size: file.size });
      const put = await fetch(prepared.signedUrl, { method: "PUT", headers: { "content-type": prepared.mimeType || file.type }, body: file });
      if (!put.ok) throw new Error("อัปโหลดไฟล์ไม่สำเร็จ");
      // The storage upload has completed, even if the following AI step fails.
      // Keep this optimistic record so the user never sees the file disappear.
      setUploadedDocs(current => ({
        ...current,
        [role]: { id: prepared.documentId, type: role, file_name: file.name, status: "extracting", created_at: new Date().toISOString() },
      }));
      uploadStored = true;
      setBusyRoles(current => { const next = new Set(current); next.delete(role); return next; });
      setProcessingRoles(current => new Set(current).add(role));
      const localExtraction = await extractLocally(file).catch(() => null);
      if (localExtraction) {
        await api(`/api/documents/${prepared.documentId}/extraction`, "POST", {
          rawExtractionJson: { text: localExtraction.text, courses: localExtraction.courses },
          confidence: localExtraction.confidence,
          status: "uploaded",
        }).catch(() => undefined);
      }
      await api("/api/academic-profile", "POST", { consent: true });
      await reload();
      setUploadedDocs({});
      notice("อัปโหลดเอกสารสำเร็จแล้ว — AI กำลังอ่านข้อมูลเบื้องหลัง คุณไม่ต้องรอหน้านี้");
    } catch (error) {
      if (uploadStored) {
        setUploadedDocs(current => current[role] ? { ...current, [role]: { ...current[role], status: "failed" } } : current);
      }
      void reload();
      notice(`อัปโหลด ${role === "study_plan" ? "Study Plan" : "Transcript"} สำเร็จ แต่ AI อ่านเอกสารไม่สำเร็จ: ${error instanceof Error ? error.message : "โปรดลองใหม่อีกครั้ง"}`);
    } finally {
      setBusyRoles(current => { const next = new Set(current); next.delete(role); return next; });
      setProcessingRoles(current => { const next = new Set(current); next.delete(role); return next; });
    }
  };
  const retryAnalysis = async () => {
    setRetrying(true);
    try {
      await api("/api/academic-profile", "POST", { consent: true });
      await reload();
      setUploadedDocs({});
      notice("เริ่มอ่านเอกสารด้วย AI อีกครั้งแล้ว — คุณไม่ต้องรอหน้านี้");
    } catch (error) {
      await reload();
      notice(`AI ยังอ่านเอกสารไม่สำเร็จ: ${error instanceof Error ? error.message : "โปรดลองใหม่อีกครั้ง"}`);
    } finally {
      setRetrying(false);
    }
  };
  return (
    <>
      <section className="card p-6">
        <Upload className="text-blue-600" />
        <h2 className="mt-4 font-bold">เอกสารสำหรับสร้างข้อมูลการเรียน</h2>
        <p className="mt-2 text-sm text-slate-600">อัปโหลดแผนการศึกษากับผลการเรียนแยกกันได้ (PDF, JPG หรือ PNG ไม่เกิน 10 MB) ทุกครั้งที่อัปโหลดหรือแทนที่ไฟล์ ระบบจะอ่านและรวมเอกสารที่มีอยู่เพื่อสร้างข้อมูลการเรียนชุดเดียว</p>
        <section className="mt-5" aria-labelledby="document-files-title">
          <h3 id="document-files-title" className="font-semibold text-slate-900">ไฟล์เอกสาร</h3>
          <p className="mt-1 text-sm text-slate-600">จัดการไฟล์ต้นทางแยกตามประเภท การแทนที่ไฟล์หนึ่งจะไม่ลบอีกไฟล์</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <UploadSlot role="study_plan" title="Study Plan" description="แผนการศึกษาและวิชาที่ต้องเรียน" doc={studyPlan} disabled={isProcessing} active={busyRoles.has("study_plan")} upload={upload} />
            <UploadSlot role="transcript" title="Transcript" description="ผลการเรียนและเกรดที่ได้รับ" doc={transcript} disabled={isProcessing} active={busyRoles.has("transcript")} upload={upload} />
          </div>
        </section>
        <ProcessingStatus summary={processingSummary} busy={isProcessing} retry={retryAnalysis} />
      </section>
    </>
  );
}

function UploadSlot({ role, title, description, doc, disabled, active, upload }: { role: "study_plan" | "transcript"; title: string; description: string; doc?: Doc; disabled: boolean; active: boolean; upload: (role: "study_plan" | "transcript", files: FileList | null) => Promise<void> }) {
  return <section className="rounded-lg border border-blue-100 bg-slate-50 p-4">
    <h3 className="font-semibold">{title}</h3>
    <p className="mt-1 text-sm text-slate-600">{description}</p>
    <label className={`btn btn-primary mt-4 inline-block text-center ${disabled ? "cursor-not-allowed opacity-60" : ""}`} aria-disabled={disabled}>
      {active ? "กำลังอัปโหลด…" : doc ? "แทนที่เอกสาร" : `อัปโหลด ${title}`}
      <input className="sr-only" disabled={disabled} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => void upload(role, event.target.files)} />
    </label>
    <div className="mt-4 rounded bg-white p-3 text-sm">
      {doc ? <div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate">{doc.file_name}</span><span className="status info shrink-0">{documentStatusLabels[doc.status] || doc.status}</span></div> : <span className="text-slate-500">ยังไม่ได้อัปโหลดเอกสาร</span>}
    </div>
    {doc?.status === "failed" && <p className="mt-3 text-sm text-red-700">สาเหตุ: {documentExtractionErrorMessage(doc.extraction_error)}</p>}
  </section>;
}

function ProcessingStatus({ summary, busy, retry }: { summary: ReturnType<typeof summarizeAcademicDocumentProcessing>; busy: boolean; retry: () => Promise<void> }) {
  const isProcessing = summary.state === "processing";
  const tone = summary.state === "retryable" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50";
  return <section className={`mt-5 rounded-lg border p-4 text-sm text-slate-700 ${tone}`} aria-labelledby="processing-title">
    <h3 id="processing-title" className="font-semibold text-slate-900">การประมวลผลข้อมูลการเรียน</h3>
    <div className="mt-3 flex gap-3" role="status" aria-live="polite">
      {isProcessing && <LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin text-blue-600" aria-hidden="true" />}
      <div>
        <p className="font-semibold text-slate-900">{summary.title}</p>
        <p className="mt-1">{summary.description}</p>
      </div>
    </div>
    {summary.canRetry && <button className="btn btn-primary mt-4 disabled:cursor-wait disabled:opacity-60" type="button" disabled={busy} onClick={() => void retry()}>ลองประมวลผลเอกสารอีกครั้ง</button>}
  </section>;
}
