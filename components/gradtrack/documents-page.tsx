"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import {
  api,
  documentStatusLabels,
  type Doc,
  type Tab,
  type View,
} from "./shared";

export function DocumentsPage({
  docs,
  reload,
  notice,
  go,
}: {
  docs: Doc[];
  reload: () => Promise<void>;
  notice: (message: string) => void;
  go: (view: View, tab?: Tab) => void;
}) {
  type UploadRole = "study_plan" | "transcript";
  const [busyRole, setBusyRole] = useState<"study_plan" | "transcript" | null>(null);
  const [processingRole, setProcessingRole] = useState<"study_plan" | "transcript" | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Partial<Record<UploadRole, Doc>>>({});
  const [consent, setConsent] = useState(false);
  const studyPlan = uploadedDocs.study_plan || docs.find(doc => doc.type === "study_plan");
  const transcript = uploadedDocs.transcript || docs.find(doc => doc.type === "transcript");
  const isExtracting = studyPlan?.status === "extracting" || transcript?.status === "extracting";
  useEffect(() => {
    void api("/api/academic-profile").then(result => setConsent(Boolean(result.data?.consented_at))).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!isExtracting) return;
    const timer = window.setTimeout(() => void reload(), 15_000);
    return () => window.clearTimeout(timer);
  }, [isExtracting, reload]);
  const upload = async (role: "study_plan" | "transcript", files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    let uploadStored = false;
    setBusyRole(role);
    setProcessingRole(null);
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
      setBusyRole(null);
      setProcessingRole(role);
      await api("/api/academic-profile", "POST", { consent });
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
      setBusyRole(null);
      setProcessingRole(null);
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
        <h2 className="mt-4 font-bold">อัปโหลด Study Plan และ Transcript</h2>
        <p className="mt-2 text-sm text-slate-600">อัปโหลดแผนการศึกษากับผลการเรียนแยกกันได้ (PDF, JPG หรือ PNG ไม่เกิน 10 MB) การแทนที่ไฟล์หนึ่งจะไม่ลบอีกไฟล์</p>
        <label className="mt-5 flex gap-3 rounded border border-blue-100 bg-blue-50 p-3 text-sm">
          <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
          <span>ฉันยินยอมให้ GradTrack ส่งไฟล์นี้ไปยัง Gemini เพื่ออ่านและสกัดข้อมูลการศึกษา</span>
        </label>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <UploadSlot role="study_plan" title="Study Plan" description="แผนการศึกษาและวิชาที่ต้องเรียน" doc={studyPlan} consent={consent} busy={busyRole !== null || processingRole !== null || retrying} active={busyRole === "study_plan"} upload={upload} retry={retryAnalysis} />
          <UploadSlot role="transcript" title="Transcript" description="ผลการเรียนและเกรดที่ได้รับ" doc={transcript} consent={consent} busy={busyRole !== null || processingRole !== null || retrying} active={busyRole === "transcript"} upload={upload} retry={retryAnalysis} />
        </div>
        {!consent && <p className="mt-2 text-xs text-slate-500">กรุณายินยอมก่อนเลือกไฟล์</p>}
        {(processingRole || retrying || isExtracting) && <ProcessingStatus role={processingRole || undefined} />}
      </section>
    </>
  );
}

function UploadSlot({ role, title, description, doc, consent, busy, active, upload, retry }: { role: "study_plan" | "transcript"; title: string; description: string; doc?: Doc; consent: boolean; busy: boolean; active: boolean; upload: (role: "study_plan" | "transcript", files: FileList | null) => Promise<void>; retry: () => Promise<void> }) {
  return <section className="rounded-lg border border-blue-100 bg-slate-50 p-4">
    <h3 className="font-semibold">{title}</h3>
    <p className="mt-1 text-sm text-slate-600">{description}</p>
    <label className="btn btn-primary mt-4 inline-block text-center">
      {active ? "กำลังอัปโหลด…" : doc ? "แทนที่เอกสาร" : `อัปโหลด ${title}`}
      <input className="sr-only" disabled={busy || !consent} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => void upload(role, event.target.files)} />
    </label>
    <div className="mt-4 rounded bg-white p-3 text-sm">
      {doc ? <div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate">{doc.file_name}</span><span className="status info shrink-0">{documentStatusLabels[doc.status] || doc.status}</span></div> : <span className="text-slate-500">ยังไม่ได้อัปโหลดเอกสาร</span>}
    </div>
    {doc?.status === "rate_limited" && <p className="mt-3 text-sm text-amber-700">โควตา Gemini หมด โปรดลองอีกครั้งหลัง quota รีเซ็ตหรือเปิด billing</p>}
    {(doc?.status === "failed" || doc?.status === "rate_limited") && <button className="mt-3 text-sm font-medium text-blue-700 underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={busy} onClick={() => void retry()}>ลองอ่านด้วย AI อีกครั้ง</button>}
  </section>;
}

function ProcessingStatus({ role }: { role?: "study_plan" | "transcript" }) {
  const title = role === "study_plan" ? "Study Plan" : role === "transcript" ? "Transcript" : "เอกสารที่บันทึกไว้";
  return <div className="mt-5 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700" role="status" aria-live="polite">
    <LoaderCircle className="mt-0.5 size-5 shrink-0 animate-spin text-blue-600" aria-hidden="true" />
    <div>
      <p className="font-semibold text-slate-900">{role ? `อัปโหลด ${title} เรียบร้อยแล้ว` : "กำลังลองอ่านเอกสารอีกครั้ง"}</p>
      <p className="mt-1">AI กำลังอ่านข้อมูลเบื้องหลัง คุณสามารถออกจากหน้านี้หรือทำงานส่วนอื่นต่อได้</p>
    </div>
  </div>;
}
