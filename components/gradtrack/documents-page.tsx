"use client";

import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
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
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  useEffect(() => {
    void api("/api/academic-profile").then(result => setConsent(Boolean(result.data?.consented_at))).catch(() => undefined);
  }, []);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const uploaded = await Promise.all([...files].map(async file => {
        const prepared = await api("/api/documents", "POST", { type: "academic_source", fileName: file.name, mimeType: file.type, size: file.size });
        const put = await fetch(prepared.signedUrl, { method: "PUT", headers: { "content-type": prepared.mimeType || file.type }, body: file });
        if (!put.ok) throw new Error("อัปโหลดไฟล์ไม่สำเร็จ");
        return prepared.documentId as string;
      }));
      await api("/api/academic-profile", "POST", { documentIds: uploaded, consent });
      await reload();
      notice("AI อ่านและรวมเอกสารแล้ว — ตรวจผลลัพธ์ได้จากหน้าตรวจสอบข้อมูล");
      go("review");
    } catch (error) {
      notice(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="card p-6">
        <Upload className="text-blue-600" />
        <h2 className="mt-4 font-bold">อัปโหลดเอกสารการศึกษาของคุณ</h2>
        <p className="mt-2 text-sm text-slate-600">เลือก PDF, JPG หรือ PNG ได้หลายไฟล์พร้อมกัน (ไม่เกิน 10 MB ต่อไฟล์) AI จะระบุชนิดเอกสารและรวมเป็นโปรไฟล์การเรียนชุดเดียว</p>
        <label className="mt-5 flex gap-3 rounded border border-blue-100 bg-blue-50 p-3 text-sm">
          <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
          <span>ฉันยินยอมให้ GradTrack ส่งไฟล์นี้ไปยัง Gemini เพื่ออ่านและสกัดข้อมูลการศึกษา</span>
        </label>
        <label className="btn btn-primary mt-5 inline-block text-center">
          {busy ? "กำลังอัปโหลดและให้ AI อ่าน…" : "เลือกเอกสาร"}
          <input className="sr-only" disabled={busy || !consent} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => void upload(event.target.files)} />
        </label>
        {!consent && <p className="mt-2 text-xs text-slate-500">กรุณายินยอมก่อนเลือกไฟล์</p>}
      </section>
      {docs.filter(doc => doc.type === "academic_source").length > 0 && <section className="card mt-5 p-5"><h2 className="font-bold">ไฟล์ล่าสุด</h2><div className="mt-3 grid gap-2">{docs.filter(doc => doc.type === "academic_source").map(doc => <div key={doc.id} className="flex items-center justify-between rounded bg-slate-50 p-3 text-sm"><span className="truncate">{doc.file_name}</span><span className="status info">{documentStatusLabels[doc.status] || doc.status}</span></div>)}</div></section>}
    </>
  );
}
