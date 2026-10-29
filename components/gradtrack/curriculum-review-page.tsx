"use client";

import { useEffect, useState } from "react";
import type { Requirement } from "@/lib/types";
import {
  parseKuCpe2565Catalog,
  parseKuCpe2565Summary,
  type CatalogCourse,
  type CurriculumNode,
} from "@/lib/curriculum-profile";
import { validateCurriculumDraft } from "@/lib/curriculum-validation";
import { api, type Doc } from "./shared";
export function CurriculumReviewPage({
  docs,
  workspace,
  reload,
  notice,
}: {
  docs: Doc[];
  requirements: Requirement[];
  workspace: boolean;
  reload: () => Promise<void>;
  notice: (x: string) => void;
}) {
  const [ids, setIds] = useState<{ summary: string; catalog: string } | null>(
      null,
    ),
    [nodes, setNodes] = useState<CurriculumNode[]>([]),
    [catalog, setCatalog] = useState<CatalogCourse[]>([]),
    [assignments, setAssignments] = useState<Record<string, string>>({}),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const summary = docs.find((d) => d.type === "curriculum_summary"),
      courseCatalog = docs.find((d) => d.type === "course_catalog");
    if (!summary || !courseCatalog) return;
    void Promise.all([
      api(`/api/documents/${summary.id}/extraction`),
      api(`/api/documents/${courseCatalog.id}/extraction`),
    ])
      .then(([s, c]) => {
        const saved =
          s.data?.raw_extraction_json?.curriculumDraft ||
          c.data?.raw_extraction_json?.curriculumDraft;
        const parsed = parseKuCpe2565Summary(
          s.data?.raw_extraction_json?.text || "",
        );
        setIds({ summary: summary.id, catalog: courseCatalog.id });
        setNodes(saved?.nodes || parsed?.nodes || []);
        setCatalog(
          saved?.catalog ||
            c.data?.raw_extraction_json?.curriculumDraft?.catalog ||
            parseKuCpe2565Catalog(c.data?.raw_extraction_json?.text || ""),
        );
        setAssignments(saved?.assignments || {});
        if (!(saved?.nodes || parsed?.nodes || []).length)
          setError("ไม่พบโครงสร้างหลักสูตรจากไฟล์สรุป");
      })
      .catch(() => setError("ไม่สามารถโหลดผลอ่านเอกสารหลักสูตรได้"));
  }, [docs]);
  const buckets = nodes.filter((node) => node.kind === "required_bucket");
  const visibleNodes = nodes.filter((node) => node.kind !== "container");
  const updateNode = (
    id: string,
    key: "name" | "minimumCredits",
    value: string | number,
  ) => {
    setDirty(true);
    setNodes((all) =>
      all.map((node) => (node.id === id ? { ...node, [key]: value } : node)),
    );
  };
  const updateCourse = (
    index: number,
    key: "code" | "nameEn" | "credits",
    value: string | number,
  ) => {
    setDirty(true);
    setCatalog((all) =>
      all.map((course, i) =>
        i === index ? { ...course, [key]: value } : course,
      ),
    );
  };
  async function save() {
    const issue = validateCurriculumDraft(nodes, catalog, assignments);
    if (issue) {
      setError(issue);
      return;
    }
    if (!ids) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/curriculum/draft", "POST", {
        summaryDocumentId: ids.summary,
        catalogDocumentId: ids.catalog,
        nodes,
        catalog,
        assignments,
      });
      setDirty(false);
      await reload();
      notice("ยืนยันโครงสร้างและรายวิชาของหลักสูตรแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกหลักสูตรไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  if (
    !docs.some((d) => d.type === "curriculum_summary") ||
    !docs.some((d) => d.type === "course_catalog")
  )
    return (
      <section className="card p-6">
        <h2 className="font-bold">ยังตรวจหลักสูตรไม่ได้</h2>
        <p className="mt-2 text-sm text-slate-600">
          กรุณาอัปโหลดทั้ง “สรุปโครงสร้างหลักสูตร” และ “คำอธิบายรายวิชา” ก่อน
        </p>
      </section>
    );
  return (
    <section className="space-y-5" data-dirty={dirty || undefined}>
      <section className="card p-5">
        <h2 className="font-bold">ตรวจหลักสูตรจากเอกสาร 2 ไฟล์</h2>
        <p className="mt-1 text-sm text-slate-600">
          ตรวจทีละส่วน
          แล้วระบบจะใช้ข้อมูลที่ยืนยันเพื่อเทียบกับผลการเรียนในขั้นตอนจับคู่รายวิชา
        </p>
        <ol className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <li className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <b>1. โครงสร้างหลักสูตร</b>
            <br />
            ตรวจหมวดและจำนวนหน่วยกิตที่ต้องเรียน
          </li>
          <li className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <b>2. รายวิชาในหลักสูตร</b>
            <br />
            ตรวจรหัส ชื่อ และหน่วยกิตของแต่ละวิชา
          </li>
          <li className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <b>3. ผูกวิชาบังคับ</b>
            <br />
            เลือกหมวดให้วิชาบังคับ ก่อนกดยืนยัน
          </li>
        </ol>
        {error && (
          <p className="mt-4 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </section>
      <section className="card overflow-x-auto">
        <div className="p-5">
          <h3 className="font-bold">1. โครงสร้างหลักสูตร</h3>
          <p className="mt-1 text-sm text-slate-500">
            ข้อมูลจากไฟล์ “สรุปโครงสร้างหลักสูตร” —
            ตารางนี้ไม่มีรหัสหรือชื่อรายวิชา
          </p>
        </div>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-y bg-blue-50">
            <tr>
              <th className="p-3 text-left">หมวดหลักสูตร</th>
              <th>ลักษณะหมวด</th>
              <th>หน่วยกิตที่ต้องเรียน</th>
            </tr>
          </thead>
          <tbody>
            {visibleNodes.map((node) => (
              <tr className="border-b" key={node.id}>
                <td className="p-3">
                  <input
                    aria-label="ชื่อหมวด"
                    className="w-full border-b"
                    value={node.name}
                    onChange={(e) =>
                      updateNode(node.id, "name", e.target.value)
                    }
                  />
                </td>
                <td>
                  {node.kind === "total"
                    ? "หน่วยกิตรวม"
                    : node.kind === "required_bucket"
                      ? "วิชาบังคับ"
                      : "วิชาเลือก"}
                </td>
                <td>
                  <input
                    aria-label="หน่วยกิตที่ต้องเรียน"
                    className="w-20 border-b"
                    type="number"
                    min="0"
                    step=".5"
                    value={node.minimumCredits}
                    onChange={(e) =>
                      updateNode(
                        node.id,
                        "minimumCredits",
                        Number(e.target.value),
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card overflow-x-auto">
        <div className="p-5">
          <h3 className="font-bold">2. รายวิชาในหลักสูตร</h3>
          <p className="mt-1 text-sm text-slate-500">
            ข้อมูลจากไฟล์ “คำอธิบายรายวิชา” — เลือกหมวดเฉพาะวิชาบังคับ;
            วิชาเลือกปล่อยเป็น “ไม่ใช่วิชาบังคับ” ได้
          </p>
        </div>
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-y bg-blue-50">
            <tr>
              <th className="p-3 text-left">รหัสวิชา</th>
              <th className="text-left">ชื่อรายวิชา</th>
              <th>หน่วยกิต</th>
              <th>อยู่ในหมวดวิชาบังคับ</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((course, index) => (
              <tr className="border-b" key={`${course.code}-${index}`}>
                <td className="p-3">
                  <input
                    aria-label="รหัสวิชา"
                    className="w-24 border-b"
                    value={course.code}
                    onChange={(e) =>
                      updateCourse(index, "code", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label="ชื่อรายวิชา"
                    className="w-full border-b"
                    value={course.nameEn || ""}
                    onChange={(e) =>
                      updateCourse(index, "nameEn", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label="หน่วยกิตวิชา"
                    className="w-16 border-b"
                    type="number"
                    min=".5"
                    step=".5"
                    value={course.credits || ""}
                    onChange={(e) =>
                      updateCourse(index, "credits", Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <select
                    aria-label="หมวดวิชาบังคับ"
                    value={assignments[course.code] || ""}
                    onChange={(e) => {
                      setDirty(true);
                      setAssignments((value) => ({
                        ...value,
                        [course.code]: e.target.value,
                      }));
                    }}
                  >
                    <option value="">ไม่ใช่วิชาบังคับ / ยังไม่เลือก</option>
                    {buckets.map((bucket) => (
                      <option key={bucket.id} value={bucket.id}>
                        {bucket.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          ก่อนบันทึก วิชาบังคับที่เลือกในแต่ละหมวดต้องรวมหน่วยกิตครบตามโครงสร้าง
        </p>
        <button
          className="btn btn-primary shrink-0"
          disabled={!workspace || !dirty || busy}
          onClick={() => void save()}
        >
          {busy ? "กำลังบันทึก…" : "ยืนยันข้อมูลหลักสูตร"}
        </button>
      </div>
    </section>
  );
}
