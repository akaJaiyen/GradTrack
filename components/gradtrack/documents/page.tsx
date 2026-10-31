"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { summarizeAcademicDocumentProcessing } from "@/lib/document-processing";
import { api } from "../shared/api";
import type { Doc } from "../shared/documents";
import { ProcessingStatus } from "./processing-status";
import { UploadSlot } from "./upload-slot";

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
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Partial<Record<UploadRole, Doc>>>({});
  const studyPlan = uploadedDocs.study_plan || docs.find(doc => doc.type === "study_plan");
  const transcript = uploadedDocs.transcript || docs.find(doc => doc.type === "transcript");
  const isExtracting = studyPlan?.status === "extracting" || transcript?.status === "extracting";
  const isProcessing = analysisRunning || isExtracting;
  const isInteractionLocked = busyRoles.size > 0 || isProcessing;
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
    try {
      const prepared = await api("/api/documents", "POST", { type: role, fileName: file.name, mimeType: file.type, size: file.size });
      const put = await fetch(prepared.signedUrl, { method: "PUT", headers: { "content-type": prepared.mimeType || file.type }, body: file });
      if (!put.ok) throw new Error("อัปโหลดไฟล์ไม่สำเร็จ");
      // Keep the stored file visible while the document list refreshes. AI is
      // intentionally not called here; it starts only after both files exist.
      setUploadedDocs(current => ({
        ...current,
        [role]: { id: prepared.documentId, type: role, file_name: file.name, status: "uploaded", created_at: new Date().toISOString() },
      }));
      uploadStored = true;
      await reload();
      setUploadedDocs({});
      notice(`อัปโหลด ${role === "study_plan" ? "Study Plan" : "Transcript"} สำเร็จแล้ว — อัปโหลดอีกไฟล์ให้ครบก่อน แล้วกดเริ่มวิเคราะห์`);
    } catch (error) {
      if (!uploadStored) setUploadedDocs(current => { const next = { ...current }; delete next[role]; return next; });
      void reload();
      notice(uploadStored
        ? `อัปโหลด ${role === "study_plan" ? "Study Plan" : "Transcript"} สำเร็จ แต่ไม่สามารถรีเฟรชสถานะได้: ${error instanceof Error ? error.message : "โปรดลองใหม่อีกครั้ง"}`
        : `อัปโหลด ${role === "study_plan" ? "Study Plan" : "Transcript"} ไม่สำเร็จ: ${error instanceof Error ? error.message : "โปรดลองใหม่อีกครั้ง"}`);
    } finally {
      setBusyRoles(current => { const next = new Set(current); next.delete(role); return next; });
    }
  };
  const startAnalysis = async (retry = false) => {
    setAnalysisRunning(true);
    try {
      await api("/api/academic-profile", "POST", { consent: true });
      await reload();
      setUploadedDocs({});
      notice(retry ? "เริ่มประมวลผลเอกสารด้วย AI อีกครั้งแล้ว — คุณไม่ต้องรอหน้านี้" : "เริ่มวิเคราะห์เอกสารด้วย AI แล้ว — คุณไม่ต้องรอหน้านี้");
    } catch (error) {
      await reload();
      notice(`เริ่มวิเคราะห์เอกสารไม่สำเร็จ: ${error instanceof Error ? error.message : "โปรดลองใหม่อีกครั้ง"}`);
    } finally {
      setAnalysisRunning(false);
    }
  };
  return (
    <>
      <section className="card p-6">
        <Upload className="text-blue-600" />
        <h2 className="mt-4 font-bold">เอกสารสำหรับสร้างข้อมูลการเรียน</h2>
        <p className="mt-2 text-sm text-slate-600">อัปโหลดแผนการศึกษากับผลการเรียนให้ครบก่อน (PDF, JPG หรือ PNG ไม่เกิน 10 MB) แล้วกดเริ่มวิเคราะห์เพื่อให้ AI อ่านทั้งสองไฟล์พร้อมกัน</p>
        <section className="mt-5" aria-labelledby="document-files-title">
          <h3 id="document-files-title" className="font-semibold text-slate-900">ไฟล์เอกสาร</h3>
          <p className="mt-1 text-sm text-slate-600">จัดการไฟล์ต้นทางแยกตามประเภท การแทนที่ไฟล์หนึ่งจะไม่ลบอีกไฟล์</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <UploadSlot role="study_plan" title="Study Plan" description="แผนการศึกษาและวิชาที่ต้องเรียน" doc={studyPlan} disabled={isInteractionLocked} active={busyRoles.has("study_plan")} upload={upload} />
            <UploadSlot role="transcript" title="Transcript" description="ผลการเรียนและเกรดที่ได้รับ" doc={transcript} disabled={isInteractionLocked} active={busyRoles.has("transcript")} upload={upload} />
          </div>
        </section>
        <ProcessingStatus summary={processingSummary} busy={isInteractionLocked} start={startAnalysis} />
      </section>
    </>
  );
}
