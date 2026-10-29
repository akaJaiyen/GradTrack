"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { extractLocally } from "@/lib/client-ocr";
import {
  parseKuCpe2565Catalog,
  parseKuCpe2565Summary,
} from "@/lib/curriculum-profile";
import {
  api,
  documentStatusLabels,
  type Doc,
  type Tab,
  type View,
} from "./shared";

const documentCards = [
  {
    type: "curriculum_summary",
    title: "สรุปโครงสร้างหลักสูตร",
    desc: "ผังหมวดและยอดหน่วยกิต",
    tab: "curriculum" as Tab,
  },
  {
    type: "course_catalog",
    title: "คำอธิบายรายวิชา",
    desc: "รหัส ชื่อ และหน่วยกิตรายวิชา",
    tab: "curriculum" as Tab,
  },
  {
    type: "transcript",
    title: "ผลการเรียน",
    desc: "รายวิชา หน่วยกิต และเกรด",
    tab: "student" as Tab,
  },
];

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
  const [busy, setBusy] = useState<string | null>(null);
  const upload = async (type: string, file?: File) => {
    if (!file) return;
    setBusy(type);
    try {
      const prepared = await api("/api/documents", "POST", {
        type,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      });
      const put = await fetch(prepared.signedUrl, {
        method: "PUT",
        headers: { "content-type": prepared.mimeType || file.type },
        body: file,
      });
      if (!put.ok) throw new Error("อัปโหลดไฟล์ไม่สำเร็จ");
      const extraction = await extractLocally(file);
      const curriculumDraft =
        type === "curriculum_summary"
          ? parseKuCpe2565Summary(extraction.text)
          : type === "course_catalog"
            ? {
                profile: "ku-cpe-2565",
                nodes: [],
                catalog: parseKuCpe2565Catalog(extraction.text),
                assignments: {},
              }
            : undefined;
      await api(`/api/documents/${prepared.documentId}/extraction`, "POST", {
        rawExtractionJson: {
          text: extraction.text,
          courses: type === "transcript" ? extraction.courses : [],
          curriculumDraft,
        },
        confidence: extraction.confidence,
        status: "review_needed",
      });
      await reload();
      notice("อ่านเอกสารแล้ว — โปรดตรวจสอบและบันทึกข้อมูล");
    } catch (error) {
      notice(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <p className="mb-5 text-sm text-slate-600">
        อัปโหลด PDF, JPG หรือ PNG ไม่เกิน 10 MB
        ไฟล์ใหม่จะแทนที่ไฟล์เดิมในประเภทเดียวกัน
      </p>
      <div className="grid gap-5 md:grid-cols-3">
        {documentCards.map((card) => {
          const document = docs.find((item) => item.type === card.type);
          return (
            <section
              className="card flex min-h-64 flex-col p-5"
              key={card.type}
            >
              <Upload className="text-blue-600" />
              <h2 className="mt-4 font-bold">{card.title}</h2>
              <p className="text-sm text-slate-500">{card.desc}</p>
              <div className="mt-4 rounded bg-slate-50 p-3 text-sm">
                <b className="block truncate">
                  {document?.file_name || "ยังไม่ได้อัปโหลด"}
                </b>
                {document ? (
                  <>
                    <span
                      className={`status mt-2 ${document.status === "ready" ? "ok" : document.status === "review_needed" ? "warn" : document.status === "failed" ? "danger" : "info"}`}
                    >
                      {documentStatusLabels[document.status] || document.status}
                    </span>
                    <p className="mt-2 text-xs text-slate-500">
                      อัปเดต{" "}
                      {new Date(document.created_at).toLocaleString("th-TH")}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">รออัปโหลดเอกสาร</p>
                )}
              </div>
              <div className="mt-auto pt-4">
                {document?.status === "review_needed" && (
                  <button
                    className="btn mb-2 w-full"
                    onClick={() => go("review", card.tab)}
                  >
                    ตรวจสอบ
                    {card.tab === "curriculum" ? "หลักสูตร" : "ผลการเรียน"}
                  </button>
                )}
                <label className="btn btn-primary block w-full text-center">
                  {busy === card.type
                    ? "กำลังอัปโหลด/อ่าน…"
                    : document
                      ? "แทนที่ไฟล์"
                      : "เลือกไฟล์"}
                  <input
                    className="sr-only"
                    disabled={!!busy}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={(event) =>
                      void upload(card.type, event.target.files?.[0])
                    }
                  />
                </label>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
