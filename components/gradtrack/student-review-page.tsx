"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { Course } from "@/lib/types";
import { api, coursePayload, grades, type Doc } from "./shared";
export function StudentReviewPage({
  docs,
  courses,
  workspace,
  reload,
  notice,
}: {
  docs: Doc[];
  courses: Course[];
  workspace: boolean;
  reload: () => Promise<void>;
  notice: (x: string) => void;
}) {
  const [rows, setRows] = useState<Course[]>(courses),
    [documentId, setDocumentId] = useState<string | null>(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => setRows(courses), [courses]);
  useEffect(() => {
    const transcript = docs.find(
      (d) => d.type === "transcript" && d.status === "review_needed",
    );
    if (!transcript) return;
    void api(`/api/documents/${transcript.id}/extraction`)
      .then((result) => {
        const extracted = result.data?.raw_extraction_json?.courses || [];
        if (extracted.length) {
          setDocumentId(transcript.id);
          setRows(
            extracted.map((r: any, i: number) => ({
              id: `new-${i}`,
              code: r.code || "",
              nameTh: r.name || "",
              credits: Number(r.credits) || 3,
              grade: r.grade || undefined,
            })),
          );
          setDirty(true);
        }
      })
      .catch(() => setError("ไม่สามารถโหลดผลการอ่านเอกสารได้"));
  }, [docs]);
  const change = (i: number, k: keyof Course, v: any) => {
    setDirty(true);
    setRows((x) => x.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  };
  const save = async () => {
    if (rows.some((r) => !r.code || !r.nameTh || Number(r.credits) <= 0)) {
      setError("กรุณากรอกรหัส ชื่อ และหน่วยกิตให้ครบ");
      return;
    }
    setBusy(true);
    try {
      if (documentId) {
        await api(`/api/documents/${documentId}/extraction`, `PUT`, {
          courses: rows.map((r) => ({
            code: r.code,
            name: r.nameTh,
            credits: Number(r.credits),
            grade: r.grade || undefined,
          })),
        });
      } else {
        const current = new Set(
          rows.filter((r) => !r.id.startsWith("new-")).map((r) => r.id),
        );
        await Promise.all([
          ...rows.map((r) =>
            r.id.startsWith("new-")
              ? api("/api/courses", "POST", coursePayload(r))
              : api(`/api/courses/${r.id}`, "PATCH", coursePayload(r)),
          ),
          ...courses
            .filter((r) => !current.has(r.id))
            .map((r) => api(`/api/courses/${r.id}`, "DELETE")),
        ]);
      }
      setDirty(false);
      await reload();
      notice("บันทึกผลการเรียนแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section data-dirty={dirty || undefined} className="space-y-5">
      <div className="card p-5">
        <h2 className="font-bold">ผลการเรียน</h2>
        <p className="text-sm text-slate-600">
          ตรวจข้อมูลจาก transcript และแก้ไขรหัส ชื่อ เกรด หน่วยกิต เพิ่ม
          หรือลบรายวิชาได้
        </p>
        {documentId && (
          <p className="mt-2 text-sm text-amber-700">
            กำลังแสดงผลที่อ่านจากเอกสาร — ตรวจแก้แล้วกดบันทึกเพื่อยืนยัน
          </p>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>
      <section className="card overflow-x-auto">
        <div className="flex justify-between p-5">
          <h3 className="font-bold">
            {documentId ? "ผลการอ่านจาก Transcript" : "รายวิชา"}
          </h3>
          <button
            className="btn"
            onClick={() => {
              setDirty(true);
              setRows((x) => [
                ...x,
                {
                  id: `new-${crypto.randomUUID()}`,
                  code: "",
                  nameTh: "",
                  credits: 3,
                },
              ]);
            }}
          >
            <Plus size={16} /> เพิ่มรายวิชา
          </button>
        </div>
        <table className="w-full min-w-[680px] text-sm">
          <thead className="border-y bg-blue-50">
            <tr>
              <th className="p-3 text-left">รหัส</th>
              <th className="text-left">ชื่อ</th>
              <th>หน่วยกิต</th>
              <th>เกรด</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr className="border-b" key={r.id}>
                <td className="p-3">
                  <input
                    aria-label="รหัสวิชา"
                    className="w-24 border-b"
                    value={r.code}
                    onChange={(e) => change(i, "code", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    aria-label="ชื่อวิชา"
                    className="w-full border-b"
                    value={r.nameTh}
                    onChange={(e) => change(i, "nameTh", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    aria-label="หน่วยกิต"
                    className="w-16 border-b"
                    type="number"
                    min=".5"
                    step=".5"
                    value={r.credits}
                    onChange={(e) =>
                      change(i, "credits", Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <select
                    aria-label="เกรด"
                    value={r.grade || ""}
                    onChange={(e) =>
                      change(i, "grade", e.target.value || undefined)
                    }
                  >
                    {["", ...grades].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    className="text-red-600"
                    aria-label="ลบรายวิชา"
                    onClick={() => {
                      setDirty(true);
                      setRows((x) => x.filter((_, n) => n !== i));
                    }}
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="flex justify-end">
        <button
          className="btn btn-primary"
          disabled={!workspace || !dirty || busy}
          onClick={() => void save()}
        >
          {busy ? "กำลังบันทึก…" : "บันทึกการเปลี่ยนแปลง"}
        </button>
      </div>
    </section>
  );
}
